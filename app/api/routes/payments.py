"""Paystack checkout and webhook routes."""
from __future__ import annotations

import hashlib
import json
import logging
import uuid
from typing import Mapping, NoReturn, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from app.auth.dependencies import get_current_user
from app.config.settings import get_settings
from app.models.database import (
    PaymentTransaction,
    PaystackSubscription,
    PaystackWebhookEvent,
    User,
)
from app.models.session import get_db_session
from app.schemas.common import ErrorCode, ErrorDetail, SuccessResponse
from app.schemas.payment import (
    InitializePaymentRequest,
    InitializePaymentResponse,
    PaymentVerificationResponse,
    PaystackPlanInfo,
    VerifyPaymentRequest,
)
from app.schemas.subscription import SubscriptionStatus
from app.services.paystack import (
    PaystackError,
    PaystackPlan,
    get_premium_plan,
    paystack_client,
    verify_webhook_signature,
)
from app.services.paystack_webhooks import (
    activate_user_subscription,
    extract_reference,
    latest_subscription,
    parse_datetime,
    process_paystack_event,
    utcnow,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments/paystack", tags=["payments"])

MAX_WEBHOOK_BYTES = 1_000_000


def _build_plan_info(settings) -> PaystackPlanInfo:
    plan = PaystackPlan(
        key="premium",
        name=settings.PAYSTACK_PREMIUM_PLAN_NAME,
        code=(settings.PAYSTACK_PREMIUM_PLAN_CODE or "").strip(),
        amount_subunit=settings.paystack_amount_subunit,
        currency=(settings.PAYSTACK_CURRENCY or "NGN").upper(),
        interval=(settings.PAYSTACK_PREMIUM_INTERVAL or "monthly").lower(),
    )
    configured = bool(
        (settings.PAYSTACK_SECRET_KEY or "").strip()
        and (settings.PAYSTACK_PUBLIC_KEY or "").strip()
        and plan.code
        and plan.amount_subunit > 0
    )
    return PaystackPlanInfo(
        plan_key=plan.key,
        name=plan.name,
        amount=float(plan.amount),
        amount_subunit=plan.amount_subunit,
        currency=plan.currency,
        interval=plan.interval,
        price_label=plan.price_label,
        configured=configured,
        public_key=(settings.PAYSTACK_PUBLIC_KEY or "").strip() or None,
    )


def _subscription_payload(
    user: User,
    subscription: Optional[PaystackSubscription],
) -> SubscriptionStatus:
    settings = get_settings()
    limit = (
        settings.PREMIUM_QUESTION_MAX
        if user.is_paid
        else settings.FREE_QUESTION_MAX
    )
    expires_at = user.subscription_expires_at or (
        subscription.next_payment_date if subscription else None
    )
    return SubscriptionStatus(
        tier="premium" if user.is_paid else "free",
        is_paid=user.is_paid,
        question_limit=limit,
        questions_used_this_month=user.questions_generated_this_month,
        questions_remaining=max(0, limit - user.questions_generated_this_month),
        expires_at=expires_at.isoformat() if expires_at else None,
        status=(
            subscription.status
            if subscription is not None
            else ("active" if user.is_paid else "none")
        ),
        plan_code=subscription.plan_code if subscription else None,
        renewal_date=(
            subscription.next_payment_date.isoformat()
            if subscription and subscription.next_payment_date
            else None
        ),
    )


def _raise_paystack_error(exc: PaystackError) -> NoReturn:
    code = (
        ErrorCode.PAYSTACK_NOT_CONFIGURED
        if exc.code == "PAYSTACK_NOT_CONFIGURED"
        else ErrorCode.PAYSTACK_ERROR
    )
    raise HTTPException(
        status_code=exc.status_code,
        detail=ErrorDetail(
            code=code,
            message=exc.message,
            recoverable=True,
            suggestions=["Try again, or contact support if the problem continues."],
        ).model_dump(),
    )


def _event_key(event_type: str, data: Mapping, raw_body: bytes) -> str:
    identifier = data.get("id") or data.get("reference")
    if not identifier and isinstance(data.get("invoice"), dict):
        identifier = data["invoice"].get("id")
    if identifier:
        return f"{event_type}:{identifier}"[:160]
    return f"{event_type}:{hashlib.sha256(raw_body).hexdigest()}"[:160]


@router.get("/plan", response_model=SuccessResponse[PaystackPlanInfo])
async def get_paystack_plan(
    _user: User = Depends(get_current_user),
):
    """Expose public checkout details (never the secret key)."""
    return SuccessResponse(data=_build_plan_info(get_settings()))


@router.post(
    "/initialize",
    response_model=SuccessResponse[InitializePaymentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def initialize_paystack_payment(
    request: InitializePaymentRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Initialize a card-only recurring checkout for the premium plan."""
    if request.plan != "premium":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.INVALID_REQUEST,
                message="Unknown plan.",
                recoverable=True,
                suggestions=["Use plan 'premium'."],
            ).model_dump(),
        )

    if user.is_paid:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_ALREADY_ACTIVE,
                message="This account already has an active premium subscription.",
                recoverable=False,
                suggestions=["Manage or cancel the current plan from your profile."],
            ).model_dump(),
        )

    settings = get_settings()
    if not (settings.PAYSTACK_PUBLIC_KEY or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorDetail(
                code=ErrorCode.PAYSTACK_NOT_CONFIGURED,
                message="Paystack public key is not configured.",
                recoverable=True,
                suggestions=["Set PAYSTACK_PUBLIC_KEY in the server environment."],
            ).model_dump(),
        )

    try:
        plan = get_premium_plan(settings)
        reference = f"APEX-{uuid.uuid4().hex}"
        metadata = {
            "user_id": str(user.id),
            "plan_key": plan.key,
            "plan_code": plan.code,
        }
        paystack_data = await paystack_client.initialize_transaction(
            email=str(request.email or user.email),
            plan_code=plan.code,
            amount_subunit=plan.amount_subunit,
            currency=plan.currency,
            callback_url=settings.PAYSTACK_CALLBACK_URL,
            metadata=metadata,
            reference=reference,
            channels=("card",),
        )
    except PaystackError as exc:
        _raise_paystack_error(exc)

    authorization_url = paystack_data.get("authorization_url")
    if not authorization_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=ErrorDetail(
                code=ErrorCode.PAYSTACK_ERROR,
                message="Paystack did not return a checkout URL.",
                recoverable=True,
            ).model_dump(),
        )

    stored_reference = str(paystack_data.get("reference") or reference)
    transaction = PaymentTransaction(
        user_id=user.id,
        reference=stored_reference,
        plan_key=plan.key,
        plan_code=plan.code,
        amount=plan.amount_subunit,
        currency=plan.currency,
        email=str(request.email or user.email),
        status="pending",
        authorization_url=authorization_url,
        access_code=paystack_data.get("access_code"),
    )
    session.add(transaction)
    await session.commit()

    return SuccessResponse(
        data=InitializePaymentResponse(
            reference=stored_reference,
            authorization_url=authorization_url,
            access_code=paystack_data.get("access_code"),
            public_key=settings.PAYSTACK_PUBLIC_KEY.strip(),
            email=request.email or user.email,
            plan=_build_plan_info(settings),
        ),
        message="Checkout initialized",
    )


@router.post(
    "/verify",
    response_model=SuccessResponse[PaymentVerificationResponse],
)
async def verify_paystack_payment(
    request: VerifyPaymentRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
):
    """Verify a checkout server-side before provisioning access.

    The frontend callback is only a hint. Access is granted here only after
    Paystack confirms a successful card charge for this user's transaction.
    """
    result = await session.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.reference == request.reference,
            PaymentTransaction.user_id == user.id,
        )
    )
    transaction = result.scalars().first()
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_NOT_FOUND,
                message="Payment reference not found.",
                recoverable=False,
            ).model_dump(),
        )

    if transaction.status == "success":
        return SuccessResponse(
            data=PaymentVerificationResponse(
                reference=transaction.reference,
                status="success",
                subscription=_subscription_payload(
                    user, await latest_subscription(session, user.id)
                ),
            ),
            message="Payment already verified",
        )

    settings = get_settings()
    try:
        verified = await paystack_client.verify_transaction(transaction.reference)
    except PaystackError as exc:
        _raise_paystack_error(exc)

    if str(verified.get("reference") or "") != transaction.reference:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_FAILED,
                message="The verified transaction reference does not match.",
                recoverable=False,
            ).model_dump(),
        )

    if str(verified.get("status") or "").lower() != "success":
        transaction.status = "failed"
        transaction.updated_at = utcnow()
        session.add(transaction)
        await session.commit()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_FAILED,
                message="The payment was not successful.",
                recoverable=True,
                suggestions=["Try the checkout again with a valid card."],
            ).model_dump(),
        )

    try:
        paid_amount = int(verified.get("amount") or 0)
    except (TypeError, ValueError):
        paid_amount = 0
    if paid_amount != transaction.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_FAILED,
                message="The paid amount does not match the plan price.",
                recoverable=False,
            ).model_dump(),
        )

    verified_channel = str(verified.get("channel") or "").lower()
    if verified_channel and verified_channel != "card":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_FAILED,
                message="Recurring subscriptions require a card payment.",
                recoverable=True,
                suggestions=["Retry the checkout with a debit or credit card."],
            ).model_dump(),
        )

    paid_currency = str(verified.get("currency") or "").upper()
    if paid_currency and paid_currency != transaction.currency.upper():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_FAILED,
                message="The payment currency does not match the plan currency.",
                recoverable=False,
            ).model_dump(),
        )

    verified_plan = verified.get("plan")
    verified_plan_code = (
        (verified_plan.get("plan_code") or verified_plan.get("code"))
        if isinstance(verified_plan, dict)
        else verified_plan
    )
    if verified_plan_code and str(verified_plan_code) != transaction.plan_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=ErrorDetail(
                code=ErrorCode.PAYMENT_FAILED,
                message="The payment plan does not match the checkout.",
                recoverable=False,
            ).model_dump(),
        )

    configured_plan = (settings.PAYSTACK_PREMIUM_PLAN_CODE or "").strip()
    if not configured_plan or transaction.plan_code != configured_plan:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ErrorDetail(
                code=ErrorCode.PAYSTACK_NOT_CONFIGURED,
                message="The configured Paystack plan changed during checkout.",
                recoverable=False,
            ).model_dump(),
        )

    customer = verified.get("customer") or {}
    await activate_user_subscription(
        session,
        user,
        plan_code=transaction.plan_code,
        customer_code=customer.get("customer_code") if isinstance(customer, dict) else None,
        reference=transaction.reference,
        paid_at=parse_datetime(verified.get("paid_at")) or utcnow(),
    )

    transaction.status = "success"
    transaction.paystack_transaction_id = str(verified.get("id") or "") or None
    transaction.updated_at = utcnow()
    session.add(transaction)
    await session.commit()

    subscription = await latest_subscription(session, user.id)
    return SuccessResponse(
        data=PaymentVerificationResponse(
            reference=transaction.reference,
            status="success",
            subscription=_subscription_payload(user, subscription),
        ),
        message="Payment verified",
    )


@router.post("/webhook", include_in_schema=False)
async def paystack_webhook(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
):
    """Receive Paystack webhooks with signature verification + idempotency."""
    settings = get_settings()
    raw_body = await request.body()
    if len(raw_body) > MAX_WEBHOOK_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Webhook payload is too large.",
        )

    signature = request.headers.get("x-paystack-signature")
    if not verify_webhook_signature(
        raw_body,
        signature,
        settings.PAYSTACK_SECRET_KEY or "",
    ):
        logger.warning("Rejected Paystack webhook with an invalid signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=ErrorDetail(
                code=ErrorCode.PAYSTACK_SIGNATURE_INVALID,
                message="Invalid Paystack webhook signature.",
                recoverable=False,
            ).model_dump(),
        )

    try:
        payload = json.loads(raw_body)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook JSON.",
        )

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook payload.",
        )

    event_type = str(payload.get("event") or "").strip()
    data = payload.get("data")
    if not event_type or not isinstance(data, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Webhook event is missing required fields.",
        )

    event_key = _event_key(event_type, data, raw_body)
    ledger_entry = PaystackWebhookEvent(
        event_key=event_key,
        event_type=event_type,
        reference=extract_reference(data),
        payload=payload,
    )
    session.add(ledger_entry)
    try:
        await session.commit()
    except IntegrityError:
        # Paystack retries the same event; acknowledge without double-processing.
        await session.rollback()
        logger.info("Ignored duplicate Paystack event: %s", event_key)
        return SuccessResponse(message="Duplicate webhook event ignored")

    try:
        await process_paystack_event(session, event_type, data)
        ledger_entry.processed = True
        ledger_entry.processed_at = utcnow()
        session.add(ledger_entry)
        await session.commit()
    except Exception:
        logger.exception("Failed to process Paystack event: %s", event_key)
        await session.rollback()
        # Remove the ledger marker so Paystack's retry can reprocess it.
        try:
            await session.execute(
                delete(PaystackWebhookEvent).where(
                    PaystackWebhookEvent.event_key == event_key
                )
            )
            await session.commit()
        except Exception:
            await session.rollback()
            logger.exception("Could not clear failed webhook ledger entry")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed.",
        )

    return SuccessResponse(message="Webhook processed")
