"""Subscription state helpers shared by auth routes and dependencies.

The application can run without Paystack webhooks: premium access is
reconciled from Paystack when a checkout reference is pending or when a paid
subscription reaches its expiry date.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import get_settings
from app.models.database import SubscriptionTier, User
from app.services.paystack import (
    PaystackError,
    list_subscriptions,
    parse_metadata,
    verify_transaction,
)


PLAN_DAYS = {
    "hourly": 1,
    "daily": 1,
    "weekly": 7,
    "monthly": 30,
    "quarterly": 90,
    "biannually": 182,
    "annually": 365,
    "yearly": 365,
}

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "non-renewing"}
FAILED_TRANSACTION_STATUSES = {"failed", "abandoned", "reversed"}


def utcnow() -> datetime:
    """Return the current timezone-aware UTC time."""
    return datetime.now(timezone.utc)


def as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Normalize a (possibly naive, SQLite) datetime to UTC."""
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def subscription_expiry(plan: Optional[dict]) -> datetime:
    """Estimate the next billing date from a Paystack plan interval."""
    interval = str((plan or {}).get("interval") or "monthly").lower()
    return utcnow() + timedelta(days=PLAN_DAYS.get(interval, 30))


def subscription_is_expired(user: User) -> bool:
    """True when a paid subscription's expiry date has passed."""
    if not user.is_paid:
        return False
    expires = as_utc(user.subscription_expires_at)
    return expires is not None and expires <= utcnow()


def transaction_matches_plan(data: dict) -> bool:
    """Guard against activating a transaction that underpaid the plan."""
    settings = get_settings()
    plan = data.get("plan")
    plan = plan if isinstance(plan, dict) else {}
    expected_amount = int(plan.get("amount") or settings.PAYSTACK_AMOUNT)
    expected_currency = str(plan.get("currency") or settings.PAYSTACK_CURRENCY).upper()
    amount = int(data.get("amount") or 0)
    currency = str(data.get("currency") or "").upper()
    if amount < expected_amount:
        return False
    if currency and currency != expected_currency:
        return False
    return True


def activate_premium(user: User, *, reference: Optional[str], data: dict) -> None:
    """Mark a user as premium from a verified Paystack transaction."""
    plan = data.get("plan")
    if not isinstance(plan, dict):
        plan = {}
    customer = data.get("customer") or {}
    user.is_paid = True
    user.tier = SubscriptionTier.PREMIUM
    user.subscription_expires_at = subscription_expiry(plan)
    if reference:
        user.paystack_reference = reference
    if customer.get("id") is not None:
        user.paystack_customer_id = str(customer["id"])


def apply_paystack_subscription(user: User, subscription: dict) -> None:
    """Store a Paystack subscription and its next billing date."""
    user.is_paid = True
    user.tier = SubscriptionTier.PREMIUM
    if subscription.get("subscription_code"):
        user.paystack_subscription_id = str(subscription["subscription_code"])
    if subscription.get("email_token"):
        user.paystack_email_token = str(subscription["email_token"])
    customer = subscription.get("customer") or {}
    if customer.get("id") is not None:
        user.paystack_customer_id = str(customer["id"])

    next_payment = subscription.get("next_payment_date")
    parsed: Optional[datetime] = None
    if next_payment:
        try:
            parsed = as_utc(
                datetime.fromisoformat(str(next_payment).replace("Z", "+00:00"))
            )
        except ValueError:
            parsed = None
    if parsed is None:
        plan = subscription.get("plan")
        parsed = subscription_expiry(plan if isinstance(plan, dict) else {})
    user.subscription_expires_at = parsed


def downgrade_to_free(user: User) -> None:
    """Revoke premium and clear all Paystack subscription state."""
    user.is_paid = False
    user.tier = SubscriptionTier.FREE
    user.subscription_expires_at = None
    user.paystack_subscription_id = None
    user.paystack_email_token = None
    user.paystack_reference = None


async def fetch_active_subscription(user: User) -> Optional[dict]:
    """Return the user's active Paystack subscription, if any."""
    customer = user.paystack_customer_id or user.email
    subscriptions = await list_subscriptions(str(customer))
    for subscription in subscriptions:
        status = str(subscription.get("status") or "").lower()
        if status in ACTIVE_SUBSCRIPTION_STATUSES:
            return subscription
    return None


async def attach_subscription(user: User) -> bool:
    """Fetch and store the active subscription; returns True when found."""
    try:
        subscription = await fetch_active_subscription(user)
    except PaystackError:
        return False
    if not subscription:
        return False
    apply_paystack_subscription(user, subscription)
    if subscription_is_expired(user):
        plan = subscription.get("plan")
        user.subscription_expires_at = subscription_expiry(
            plan if isinstance(plan, dict) else {}
        )
    return True


async def _commit(session: AsyncSession, user: User) -> None:
    session.add(user)
    await session.commit()
    await session.refresh(user)


async def refresh_expired_subscription(user: User, session: AsyncSession) -> bool:
    """Re-check an expired subscription with Paystack and update the user.

    Fails open (keeps premium) if Paystack cannot be reached so a temporary
    outage never revokes access from a paying customer.
    """
    if not subscription_is_expired(user):
        return False

    try:
        subscription = await fetch_active_subscription(user)
    except PaystackError:
        return False

    if subscription:
        apply_paystack_subscription(user, subscription)
        if subscription_is_expired(user):
            plan = subscription.get("plan")
            user.subscription_expires_at = subscription_expiry(
                plan if isinstance(plan, dict) else {}
            )
    else:
        downgrade_to_free(user)

    await _commit(session, user)
    return True


async def reconcile_subscription(user: User, session: AsyncSession) -> bool:
    """Apply pending Paystack checkouts and expire lapsed subscriptions.

    This is the webhook-free path: the frontend calls the subscription status
    endpoint on load, which drives this reconciliation.
    """
    if not user.is_paid and user.paystack_reference:
        try:
            data = await verify_transaction(user.paystack_reference)
        except PaystackError:
            return False

        status = str(data.get("status") or "").lower()
        if status == "success":
            metadata = parse_metadata(data.get("metadata"))
            owner = str(metadata.get("user_id") or "")
            if owner and owner != str(user.id):
                user.paystack_reference = None
                await _commit(session, user)
                return False
            if not transaction_matches_plan(data):
                return False
            activate_premium(user, reference=user.paystack_reference, data=data)
            await attach_subscription(user)
            await _commit(session, user)
            return True
        if status in FAILED_TRANSACTION_STATUSES:
            user.paystack_reference = None
            await _commit(session, user)
            return True
        return False

    return await refresh_expired_subscription(user, session)
