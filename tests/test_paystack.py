"""Tests for Paystack checkout, verification, and webhooks."""
import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel import select

from app.config.settings import get_settings
from app.models.database import (
    PaymentTransaction,
    PaystackSubscription,
    PaystackWebhookEvent,
    PaystackSubscriptionStatus,
    User,
)
from app.services.paystack import paystack_client


SECRET = "sk_test_webhook_secret"


@pytest.fixture(autouse=True)
def paystack_config(monkeypatch):
    """Configure Paystack for every test and restore the previous values."""
    settings = get_settings()
    values = {
        "PAYSTACK_SECRET_KEY": SECRET,
        "PAYSTACK_PUBLIC_KEY": "pk_test_public",
        "PAYSTACK_PREMIUM_PLAN_CODE": "PLN_test_premium",
        "PAYSTACK_PREMIUM_PRICE": Decimal("5000"),
        "PAYSTACK_CURRENCY": "NGN",
        "PAYSTACK_PREMIUM_INTERVAL": "monthly",
        "PAYSTACK_CALLBACK_URL": "http://test.local/payment/callback",
    }
    for key, value in values.items():
        monkeypatch.setattr(settings, key, value, raising=False)
    return settings


async def _register(client: AsyncClient, email: str) -> tuple[dict, str]:
    response = await client.post(
        "/api/auth/register",
        json={
            "email": email,
            "password": "password123",
            "full_name": "Bluetooth User",
        },
    )
    assert response.status_code == 201
    data = response.json()["data"]
    return {"Authorization": f"Bearer {data['access_token']}"}, data["user"]["id"]


def _sign(payload: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode(), payload, hashlib.sha512).hexdigest()


async def _post_webhook(client: AsyncClient, payload: dict, signature: str | None = None):
    body = json.dumps(payload).encode()
    headers = {"Content-Type": "application/json"}
    if signature is not None:
        headers["x-paystack-signature"] = signature
    return await client.post(
        "/api/payments/paystack/webhook",
        content=body,
        headers=headers,
    )


def _charge_event(
    *,
    user_id: str,
    reference: str,
    amount: int = 500000,
    customer_code: str | None = None,
) -> dict:
    return {
        "event": "charge.success",
        "data": {
            "id": int(hashlib.sha256(reference.encode()).hexdigest()[:12], 16),
            "status": "success",
            "reference": reference,
            "amount": amount,
            "currency": "NGN",
            "channel": "card",
            "paid_at": datetime.now(timezone.utc).isoformat(),
            "customer": {
                "id": 101,
                "customer_code": customer_code
                or f"CUS_{user_id.replace('-', '')[:16]}",
                "email": f"payer-{user_id[:8]}@example.com",
            },
            "plan": {
                "plan_code": "PLN_test_premium",
                "name": "Apex Quiz Premium",
                "amount": 500000,
                "interval": "monthly",
            },
            "metadata": {"user_id": user_id, "plan_code": "PLN_test_premium"},
        },
    }


class TestPaystackCheckout:
    @pytest.mark.asyncio
    async def test_initialize_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/payments/paystack/initialize", json={"plan": "premium"})
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_initialize_uses_plan_and_subunit_amount(
        self,
        client: AsyncClient,
        monkeypatch,
        db_session,
    ):
        headers, user_id = await _register(client, "checkout@example.com")
        captured: dict = {}

        async def fake_initialize(**kwargs):
            captured.update(kwargs)
            return {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "ac_test_123",
                "reference": kwargs["reference"],
            }

        monkeypatch.setattr(paystack_client, "initialize_transaction", fake_initialize)

        response = await client.post(
            "/api/payments/paystack/initialize",
            json={"plan": "premium"},
            headers=headers,
        )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["plan"]["plan_key"] == "premium"
        assert data["plan"]["amount_subunit"] == 500000
        assert data["plan"]["currency"] == "NGN"
        assert data["public_key"] == "pk_test_public"
        assert data["reference"].startswith("APEX-")
        assert captured["amount_subunit"] == 500000
        assert captured["plan_code"] == "PLN_test_premium"
        assert captured["channels"] == ("card",)
        assert captured["metadata"]["user_id"] == user_id

        result = await db_session.execute(
            select(PaymentTransaction).where(PaymentTransaction.reference == data["reference"])
        )
        transaction = result.scalars().first()
        assert transaction is not None
        assert transaction.amount == 500000
        assert transaction.status == "pending"

    @pytest.mark.asyncio
    async def test_initialize_rejects_client_supplied_amount(self, client: AsyncClient):
        headers, _ = await _register(client, "tamper@example.com")
        response = await client.post(
            "/api/payments/paystack/initialize",
            json={"plan": "premium", "amount": 100},
            headers=headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_initialize_rejects_unknown_plan(self, client: AsyncClient):
        headers, _ = await _register(client, "unknown-plan@example.com")
        response = await client.post(
            "/api/payments/paystack/initialize",
            json={"plan": "enterprise"},
            headers=headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_initialize_unconfigured_returns_503(self, client: AsyncClient, monkeypatch):
        headers, _ = await _register(client, "unconfigured@example.com")
        monkeypatch.setattr(get_settings(), "PAYSTACK_PREMIUM_PLAN_CODE", "", raising=False)
        response = await client.post(
            "/api/payments/paystack/initialize",
            json={"plan": "premium"},
            headers=headers,
        )
        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "PAYSTACK_NOT_CONFIGURED"

    @pytest.mark.asyncio
    async def test_verify_activates_premium_and_is_idempotent(
        self,
        client: AsyncClient,
        monkeypatch,
        db_session,
    ):
        headers, user_id = await _register(client, "verify@example.com")

        async def fake_initialize(**kwargs):
            return {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "ac_verify",
                "reference": kwargs["reference"],
            }

        async def fake_verify(reference: str):
            return {
                "id": 987654321,
                "status": "success",
                "reference": reference,
                "amount": 500000,
                "currency": "NGN",
                "paid_at": datetime.now(timezone.utc).isoformat(),
                "customer": {
                    "customer_code": "CUS_verify",
                    "email": "verify@example.com",
                },
                "plan": {"plan_code": "PLN_test_premium"},
            }

        monkeypatch.setattr(paystack_client, "initialize_transaction", fake_initialize)
        monkeypatch.setattr(paystack_client, "verify_transaction", fake_verify)

        init_response = await client.post(
            "/api/payments/paystack/initialize",
            json={"plan": "premium"},
            headers=headers,
        )
        reference = init_response.json()["data"]["reference"]

        response = await client.post(
            "/api/payments/paystack/verify",
            json={"reference": reference},
            headers=headers,
        )
        assert response.status_code == 200
        payload = response.json()["data"]
        assert payload["status"] == "success"
        assert payload["subscription"]["tier"] == "premium"
        assert payload["subscription"]["is_paid"] is True
        assert payload["subscription"]["question_limit"] == 50
        assert payload["subscription"]["status"] == "active"

        # A replay must not double-charge or create a second subscription.
        replay = await client.post(
            "/api/payments/paystack/verify",
            json={"reference": reference},
            headers=headers,
        )
        assert replay.status_code == 200

        user = await db_session.get(User, uuid.UUID(user_id))
        assert user is not None
        assert user.is_paid is True
        assert user.tier.value == "premium"

        subs = (
            await db_session.execute(
                select(PaystackSubscription).where(PaystackSubscription.user_id == user.id)
            )
        ).scalars().all()
        assert len(subs) == 1
        assert subs[0].status == PaystackSubscriptionStatus.ACTIVE.value

    @pytest.mark.asyncio
    async def test_verify_rejects_another_users_reference(
        self,
        client: AsyncClient,
        monkeypatch,
    ):
        headers, _ = await _register(client, "owner@example.com")
        other_headers, _ = await _register(client, "attacker@example.com")

        async def fake_initialize(**kwargs):
            return {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "ac_owner",
                "reference": kwargs["reference"],
            }

        monkeypatch.setattr(paystack_client, "initialize_transaction", fake_initialize)
        init_response = await client.post(
            "/api/payments/paystack/initialize",
            json={"plan": "premium"},
            headers=headers,
        )
        reference = init_response.json()["data"]["reference"]

        response = await client.post(
            "/api/payments/paystack/verify",
            json={"reference": reference},
            headers=other_headers,
        )
        assert response.status_code == 404


class TestPaystackWebhooks:
    @pytest.mark.asyncio
    async def test_webhook_rejects_missing_or_bad_signature(self, client: AsyncClient):
        payload = _charge_event(
            user_id="00000000-0000-0000-0000-000000000000",
            reference="APEX-badsig001",
        )
        missing = await _post_webhook(client, payload)
        assert missing.status_code == 401

        bad = await _post_webhook(client, payload, signature="0" * 128)
        assert bad.status_code == 401

    @pytest.mark.asyncio
    async def test_charge_success_provisions_premium_once(
        self,
        client: AsyncClient,
        db_session,
    ):
        headers, user_id = await _register(client, "webhook@example.com")
        reference = f"APEX-{uuid.uuid4().hex[:16]}"
        payload = _charge_event(user_id=user_id, reference=reference)
        body = json.dumps(payload).encode()

        response = await _post_webhook(client, payload, signature=_sign(body))
        assert response.status_code == 200

        user = await db_session.get(User, uuid.UUID(user_id))
        assert user is not None
        assert user.is_paid is True
        assert user.tier.value == "premium"

        # Duplicate delivery must be acknowledged but not reprocessed.
        duplicate = await _post_webhook(client, payload, signature=_sign(body))
        assert duplicate.status_code == 200
        assert "Duplicate" in duplicate.json()["message"]

        events = (
            await db_session.execute(
                select(PaystackWebhookEvent).where(
                    PaystackWebhookEvent.reference == reference
                )
            )
        ).scalars().all()
        assert len(events) == 1
        assert events[0].processed is True

    @pytest.mark.asyncio
    async def test_subscription_create_stores_codes_and_token(
        self,
        client: AsyncClient,
        db_session,
    ):
        _, user_id = await _register(client, "sub-create@example.com")
        charge = _charge_event(
            user_id=user_id,
            reference=f"APEX-{uuid.uuid4().hex[:16]}",
        )
        customer_code = charge["data"]["customer"]["customer_code"]
        body = json.dumps(charge).encode()
        assert (await _post_webhook(client, charge, signature=_sign(body))).status_code == 200

        create_event = {
            "event": "subscription.create",
            "data": {
                "id": 555001,
                "status": "active",
                "subscription_code": "SUB_test_create",
                "email_token": "email-token-secret",
                "next_payment_date": (
                    datetime.now(timezone.utc) + timedelta(days=30)
                ).isoformat(),
                "customer": {
                    "customer_code": customer_code,
                    "email": "sub-create@example.com",
                },
                "plan": {
                    "plan_code": "PLN_test_premium",
                    "interval": "monthly",
                },
                "metadata": {"user_id": user_id},
            },
        }
        create_body = json.dumps(create_event).encode()
        response = await _post_webhook(client, create_event, signature=_sign(create_body))
        assert response.status_code == 200

        sub = (
            await db_session.execute(
                select(PaystackSubscription).where(
                    PaystackSubscription.subscription_code == "SUB_test_create"
                )
            )
        ).scalars().first()
        assert sub is not None
        assert sub.email_token == "email-token-secret"
        assert sub.status == PaystackSubscriptionStatus.ACTIVE.value

    @pytest.mark.asyncio
    async def test_invoice_payment_failed_revokes_access(
        self,
        client: AsyncClient,
        db_session,
    ):
        _, user_id = await _register(client, "renewal-fail@example.com")
        charge = _charge_event(
            user_id=user_id,
            reference=f"APEX-{uuid.uuid4().hex[:16]}",
        )
        customer_code = charge["data"]["customer"]["customer_code"]
        charge_body = json.dumps(charge).encode()
        assert (await _post_webhook(client, charge, signature=_sign(charge_body))).status_code == 200

        failure = {
            "event": "invoice.payment_failed",
            "data": {
                "id": 777001,
                "status": "failed",
                "paid": False,
                "amount": 500000,
                "subscription": {
                    "subscription_code": "SUB_test_fail",
                    "status": "active",
                },
                "customer": {
                    "customer_code": customer_code,
                    "email": "renewal-fail@example.com",
                },
                "plan": {"plan_code": "PLN_test_premium"},
                "metadata": {"user_id": user_id},
            },
        }
        failure_body = json.dumps(failure).encode()
        response = await _post_webhook(client, failure, signature=_sign(failure_body))
        assert response.status_code == 200

        user = await db_session.get(User, uuid.UUID(user_id))
        assert user is not None
        assert user.is_paid is False
        assert user.tier.value == "free"

        sub = (
            await db_session.execute(
                select(PaystackSubscription).where(
                    PaystackSubscription.user_id == user.id
                )
            )
        ).scalars().first()
        assert sub is not None
        assert sub.status == PaystackSubscriptionStatus.PAST_DUE.value
        assert sub.last_failure_at is not None

    @pytest.mark.asyncio
    async def test_cancel_disables_paystack_subscription(
        self,
        client: AsyncClient,
        db_session,
        monkeypatch,
    ):
        headers, user_id = await _register(client, "cancel-paystack@example.com")
        charge = _charge_event(
            user_id=user_id,
            reference=f"APEX-{uuid.uuid4().hex[:16]}",
        )
        charge_body = json.dumps(charge).encode()
        assert (await _post_webhook(client, charge, signature=_sign(charge_body))).status_code == 200

        sub = (
            await db_session.execute(
                select(PaystackSubscription).where(
                    PaystackSubscription.user_id == uuid.UUID(user_id)
                )
            )
        ).scalars().first()
        sub.subscription_code = "SUB_test_cancel"
        sub.email_token = "token-cancel"
        db_session.add(sub)
        await db_session.commit()

        captured: dict = {}

        async def fake_disable(subscription_code: str, email_token: str):
            captured["subscription_code"] = subscription_code
            captured["email_token"] = email_token
            return {"status": "success"}

        monkeypatch.setattr(paystack_client, "disable_subscription", fake_disable)

        response = await client.post("/api/auth/cancel", headers=headers)
        assert response.status_code == 200
        assert captured == {
            "subscription_code": "SUB_test_cancel",
            "email_token": "token-cancel",
        }
        assert response.json()["data"]["tier"] == "free"
