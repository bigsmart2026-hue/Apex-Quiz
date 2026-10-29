"""Apply verified Paystack webhook events to local subscription state.

Every handler is idempotent-friendly: Paystack retries webhooks, so access
is only granted when a known, verified plan is involved and every event is
recorded in the webhook ledger by the route before it reaches this module.
"""
from __future__ import annotations

import json
import logging
import uuid
from calendar import monthrange
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.models.database import (
    PaystackSubscription,
    PaystackSubscriptionStatus,
    PaymentTransaction,
    SubscriptionTier,
    User,
)


logger = logging.getLogger(__name__)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def parse_datetime(value: Any) -> Optional[datetime]:
    """Parse a Paystack ISO timestamp into an aware UTC datetime."""
    if not value:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except (TypeError, ValueError):
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def add_billing_interval(start: datetime, interval: Optional[str]) -> datetime:
    """Add one plan interval to ``start`` using calendar-aware month math."""
    interval = (interval or "monthly").lower()
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)

    if interval == "hourly":
        return start + timedelta(hours=1)
    if interval == "daily":
        return start + timedelta(days=1)
    if interval == "weekly":
        return start + timedelta(weeks=1)

    months = {
        "monthly": 1,
        "quarterly": 3,
        "biannually": 6,
        "annually": 12,
    }.get(interval, 1)

    month_index = start.month - 1 + months
    year = start.year + month_index // 12
    month = month_index % 12 + 1
    day = min(start.day, monthrange(year, month)[1])
    return start.replace(year=year, month=month, day=day)


def extract_metadata(data: Mapping[str, Any]) -> dict:
    """Paystack metadata can be an object or a JSON string."""
    raw = data.get("metadata")
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, str) and raw.strip():
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else {}
        except ValueError:
            return {}
    return {}


def extract_plan_code(data: Mapping[str, Any]) -> Optional[str]:
    plan = data.get("plan")
    if isinstance(plan, dict):
        code = plan.get("plan_code") or plan.get("code")
        if code:
            return str(code)
    elif isinstance(plan, str) and plan.strip():
        return plan.strip()

    plan_object = data.get("plan_object")
    if isinstance(plan_object, dict):
        code = plan_object.get("plan_code") or plan_object.get("code")
        if code:
            return str(code)

    subscription = data.get("subscription")
    if isinstance(subscription, dict):
        nested_plan = subscription.get("plan")
        if isinstance(nested_plan, dict):
            code = nested_plan.get("plan_code") or nested_plan.get("code")
            if code:
                return str(code)

    metadata_code = extract_metadata(data).get("plan_code")
    if metadata_code:
        return str(metadata_code)
    return None


def extract_plan_interval(data: Mapping[str, Any]) -> Optional[str]:
    plan = data.get("plan")
    if isinstance(plan, dict) and plan.get("interval"):
        return str(plan["interval"])
    subscription = data.get("subscription")
    if isinstance(subscription, dict):
        nested_plan = subscription.get("plan")
        if isinstance(nested_plan, dict) and nested_plan.get("interval"):
            return str(nested_plan["interval"])
    return None


def extract_subscription_code(data: Mapping[str, Any]) -> Optional[str]:
    code = data.get("subscription_code")
    if code:
        return str(code)
    subscription = data.get("subscription")
    if isinstance(subscription, dict):
        code = subscription.get("subscription_code") or subscription.get("code")
        if code:
            return str(code)
        # Some invoice events nest the subscription one level deeper.
        nested = subscription.get("subscription")
        if isinstance(nested, dict) and nested.get("subscription_code"):
            return str(nested["subscription_code"])
    return None


def extract_customer_code(data: Mapping[str, Any]) -> Optional[str]:
    code = data.get("customer_code")
    if code:
        return str(code)
    customer = data.get("customer")
    if isinstance(customer, dict) and customer.get("customer_code"):
        return str(customer["customer_code"])
    return None


def extract_email(data: Mapping[str, Any]) -> Optional[str]:
    email = data.get("email")
    if email:
        return str(email)
    customer = data.get("customer")
    if isinstance(customer, dict) and customer.get("email"):
        return str(customer["email"])
    return None


def extract_reference(data: Mapping[str, Any]) -> Optional[str]:
    reference = data.get("reference")
    if reference:
        return str(reference)
    transaction = data.get("transaction")
    if isinstance(transaction, dict) and transaction.get("reference"):
        return str(transaction["reference"])
    return None


def _configured_plan_code() -> str:
    return (get_settings().PAYSTACK_PREMIUM_PLAN_CODE or "").strip()


def _plan_is_allowed(plan_code: Optional[str]) -> bool:
    configured = _configured_plan_code()
    return bool(configured and plan_code and plan_code == configured)


async def latest_subscription(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> Optional[PaystackSubscription]:
    """Return the newest subscription record for a user."""
    result = await session.execute(
        select(PaystackSubscription)
        .where(PaystackSubscription.user_id == user_id)
        .order_by(PaystackSubscription.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _subscription_by_code(
    session: AsyncSession,
    subscription_code: Optional[str],
) -> Optional[PaystackSubscription]:
    if not subscription_code:
        return None
    result = await session.execute(
        select(PaystackSubscription).where(
            PaystackSubscription.subscription_code == subscription_code
        )
    )
    return result.scalars().first()


async def _subscription_by_customer(
    session: AsyncSession,
    customer_code: Optional[str],
) -> Optional[PaystackSubscription]:
    if not customer_code:
        return None
    result = await session.execute(
        select(PaystackSubscription)
        .where(PaystackSubscription.customer_code == customer_code)
        .order_by(PaystackSubscription.created_at.desc())
        .limit(1)
    )
    return result.scalars().first()


async def _user_by_email(session: AsyncSession, email: Optional[str]) -> Optional[User]:
    if not email:
        return None
    result = await session.execute(select(User).where(User.email == email))
    return result.scalars().first()


async def find_user_and_subscription(
    session: AsyncSession,
    data: Mapping[str, Any],
    transaction: Optional[PaymentTransaction] = None,
) -> tuple[Optional[User], Optional[PaystackSubscription]]:
    """Resolve the local user for a verified event.

    Preference order: our stored transaction, signed metadata, subscription
    code, customer code, then customer email. Nothing here is trusted from a
    caller without a valid webhook signature.
    """
    if transaction is not None:
        user = await session.get(User, transaction.user_id)
        if user is not None:
            return user, await latest_subscription(session, user.id)

    metadata = extract_metadata(data)
    raw_user_id = metadata.get("user_id")
    if raw_user_id:
        try:
            user = await session.get(User, uuid.UUID(str(raw_user_id)))
            if user is not None:
                return user, await latest_subscription(session, user.id)
        except (ValueError, AttributeError, TypeError):
            logger.warning("Webhook metadata contained an invalid user id")

    subscription_code = extract_subscription_code(data)
    subscription = await _subscription_by_code(session, subscription_code)
    if subscription is not None:
        user = await session.get(User, subscription.user_id)
        if user is not None:
            return user, subscription

    customer_code = extract_customer_code(data)
    subscription = await _subscription_by_customer(session, customer_code)
    if subscription is not None:
        user = await session.get(User, subscription.user_id)
        if user is not None:
            return user, subscription

    email = extract_email(data)
    if email:
        # The receipt email may be the learner's app email rather than the
        # guest backend account email, so correlate through checkout records.
        result = await session.execute(
            select(PaymentTransaction)
            .where(PaymentTransaction.email == email)
            .order_by(PaymentTransaction.created_at.desc())
            .limit(1)
        )
        checkout = result.scalars().first()
        if checkout is not None:
            user = await session.get(User, checkout.user_id)
            if user is not None:
                return user, await latest_subscription(session, user.id)

    user = await _user_by_email(session, email)
    if user is not None:
        return user, await latest_subscription(session, user.id)

    return None, None


async def activate_user_subscription(
    session: AsyncSession,
    user: User,
    *,
    plan_code: str,
    customer_code: Optional[str] = None,
    subscription_code: Optional[str] = None,
    email_token: Optional[str] = None,
    next_payment_date: Optional[datetime] = None,
    reference: Optional[str] = None,
    paid_at: Optional[datetime] = None,
    interval: Optional[str] = None,
) -> PaystackSubscription:
    """Grant premium access and upsert the Paystack subscription record."""
    now = utcnow()
    settings = get_settings()
    renewal = next_payment_date or add_billing_interval(
        paid_at or now,
        interval or settings.PAYSTACK_PREMIUM_INTERVAL,
    )

    user.is_paid = True
    user.tier = SubscriptionTier.PREMIUM
    user.subscription_expires_at = renewal
    user.updated_at = now
    session.add(user)

    subscription = await _subscription_by_code(session, subscription_code)
    if subscription is None and customer_code:
        subscription = await _subscription_by_customer(session, customer_code)
    if subscription is None:
        subscription = PaystackSubscription(
            user_id=user.id,
            plan_code=plan_code,
            status=PaystackSubscriptionStatus.ACTIVE.value,
        )
        session.add(subscription)
    elif subscription.user_id != user.id:
        logger.error("Refusing to attach a subscription owned by another user")
        raise ValueError("Subscription belongs to another user")

    subscription.plan_code = plan_code
    subscription.status = PaystackSubscriptionStatus.ACTIVE.value
    subscription.next_payment_date = renewal
    subscription.updated_at = now
    if customer_code:
        subscription.customer_code = customer_code
    if subscription_code:
        subscription.subscription_code = subscription_code
    if email_token:
        subscription.email_token = email_token
    if reference:
        subscription.last_payment_reference = reference
    if paid_at:
        subscription.last_payment_at = paid_at
    session.add(subscription)
    return subscription


async def revoke_user_subscription(
    session: AsyncSession,
    user: User,
    subscription: Optional[PaystackSubscription],
    *,
    status: PaystackSubscriptionStatus,
    mark_failure: bool = False,
) -> None:
    """Remove premium access without deleting the Paystack linkage."""
    now = utcnow()
    user.is_paid = False
    user.tier = SubscriptionTier.FREE
    user.updated_at = now
    session.add(user)

    if subscription is not None:
        subscription.status = status.value
        subscription.updated_at = now
        if mark_failure:
            subscription.last_failure_at = now
        if status in (
            PaystackSubscriptionStatus.CANCELLED,
            PaystackSubscriptionStatus.DISABLED,
        ):
            subscription.cancelled_at = now
        session.add(subscription)


async def handle_charge_success(
    session: AsyncSession,
    data: Mapping[str, Any],
) -> None:
    """Provision access after a successful card charge."""
    reference = extract_reference(data)
    transaction: Optional[PaymentTransaction] = None
    if reference:
        result = await session.execute(
            select(PaymentTransaction).where(PaymentTransaction.reference == reference)
        )
        transaction = result.scalars().first()

    user, subscription = await find_user_and_subscription(session, data, transaction)
    if user is None:
        logger.warning("charge.success could not be matched to a local user")
        return

    plan_code = (
        extract_plan_code(data)
        or (transaction.plan_code if transaction else None)
        or (subscription.plan_code if subscription else None)
    )
    if not _plan_is_allowed(plan_code):
        logger.warning("charge.success ignored for an unconfigured plan")
        return

    if str(data.get("status") or "success").lower() != "success":
        return

    channel = data.get("channel")
    if channel and str(channel).lower() != "card":
        # Recurring subscriptions are card-driven; do not provision access
        # for a one-off non-card charge.
        logger.warning("charge.success ignored for non-card channel: %s", channel)
        return

    settings = get_settings()
    expected_amount = transaction.amount if transaction else settings.paystack_amount_subunit
    try:
        paid_amount = int(data.get("amount") or 0)
    except (TypeError, ValueError):
        paid_amount = 0
    if expected_amount > 0 and paid_amount < expected_amount:
        logger.warning("charge.success ignored due to an amount mismatch")
        return

    currency = str(data.get("currency") or "").upper()
    expected_currency = (
        transaction.currency if transaction else settings.PAYSTACK_CURRENCY
    ).upper()
    if currency and currency != expected_currency:
        logger.warning("charge.success ignored due to a currency mismatch")
        return

    customer_code = extract_customer_code(data) or (
        subscription.customer_code if subscription else None
    )
    subscription_code = extract_subscription_code(data)
    paid_at = parse_datetime(data.get("paid_at")) or utcnow()

    await activate_user_subscription(
        session,
        user,
        plan_code=plan_code,
        customer_code=customer_code,
        subscription_code=subscription_code,
        reference=reference,
        paid_at=paid_at,
        interval=extract_plan_interval(data),
    )

    if transaction is not None:
        transaction.status = "success"
        transaction.paystack_transaction_id = str(data.get("id") or "") or None
        transaction.updated_at = utcnow()
        session.add(transaction)


async def handle_subscription_create(
    session: AsyncSession,
    data: Mapping[str, Any],
) -> None:
    """Record the subscription code/token and activate access."""
    user, subscription = await find_user_and_subscription(session, data)
    if user is None:
        logger.warning("subscription.create could not be matched to a local user")
        return

    plan_code = extract_plan_code(data) or (
        subscription.plan_code if subscription else None
    )
    if not _plan_is_allowed(plan_code):
        logger.warning("subscription.create ignored for an unconfigured plan")
        return

    status = str(data.get("status") or "active").lower()
    subscription_code = extract_subscription_code(data)
    customer_code = extract_customer_code(data)
    email_token = data.get("email_token")
    next_payment_date = parse_datetime(data.get("next_payment_date"))

    if status == PaystackSubscriptionStatus.ACTIVE.value:
        await activate_user_subscription(
            session,
            user,
            plan_code=plan_code,
            customer_code=customer_code,
            subscription_code=subscription_code,
            email_token=str(email_token) if email_token else None,
            next_payment_date=next_payment_date,
            interval=extract_plan_interval(data),
        )
        return

    if subscription is None:
        subscription = PaystackSubscription(
            user_id=user.id,
            plan_code=plan_code,
            status=status,
        )
    subscription.status = status
    subscription.plan_code = plan_code
    subscription.updated_at = utcnow()
    if customer_code:
        subscription.customer_code = customer_code
    if subscription_code:
        subscription.subscription_code = subscription_code
    if email_token:
        subscription.email_token = str(email_token)
    if next_payment_date:
        subscription.next_payment_date = next_payment_date
    session.add(subscription)


async def handle_invoice_payment_failed(
    session: AsyncSession,
    data: Mapping[str, Any],
) -> None:
    """Flag a failed renewal and revoke premium access."""
    user, subscription = await find_user_and_subscription(session, data)
    if user is None:
        logger.warning("invoice.payment_failed could not be matched to a local user")
        return

    plan_code = extract_plan_code(data) or (
        subscription.plan_code if subscription else None
    )
    if plan_code and not _plan_is_allowed(plan_code):
        logger.warning("invoice.payment_failed ignored for an unconfigured plan")
        return

    await revoke_user_subscription(
        session,
        user,
        subscription,
        status=PaystackSubscriptionStatus.PAST_DUE,
        mark_failure=True,
    )


async def handle_subscription_disable(
    session: AsyncSession,
    data: Mapping[str, Any],
) -> None:
    """Handle an explicit cancellation/disable from Paystack."""
    user, subscription = await find_user_and_subscription(session, data)
    if user is None:
        logger.warning("subscription.disable could not be matched to a local user")
        return

    await revoke_user_subscription(
        session,
        user,
        subscription,
        status=PaystackSubscriptionStatus.DISABLED,
    )


async def process_paystack_event(
    session: AsyncSession,
    event_type: str,
    data: Mapping[str, Any],
) -> None:
    """Dispatch a verified event to its handler."""
    if event_type == "charge.success":
        await handle_charge_success(session, data)
    elif event_type == "subscription.create":
        await handle_subscription_create(session, data)
    elif event_type == "invoice.payment_failed":
        await handle_invoice_payment_failed(session, data)
    elif event_type == "subscription.disable":
        await handle_subscription_disable(session, data)
    else:
        logger.info("Ignoring unhandled Paystack event: %s", event_type)
