"""Test subscription status and Paystack checkout endpoints."""
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlmodel import select

from app.models.database import User


async def _register(client: AsyncClient, email: str) -> dict:
    """Register a fresh user and return auth headers for it."""
    response = await client.post("/api/auth/register", json={
        "email": email,
        "password": "password123",
        "full_name": "Sub Test",
    })
    assert response.status_code == 201
    token = response.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def _user_by_email(db_session, email: str) -> User:
    result = await db_session.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    assert user is not None
    return user


def _customer_id(user: User) -> int:
    """Deterministic, collision-free fake Paystack customer id per user."""
    return user.id.int % 2_000_000_000


def _successful_transaction(user: User, amount: int = 943700) -> dict:
    return {
        "status": "success",
        "reference": "ref_test",
        "amount": amount,
        "currency": "NGN",
        "metadata": {"user_id": str(user.id), "purpose": "premium_subscription"},
        "customer": {"id": _customer_id(user), "email": user.email},
        "plan": {"amount": amount, "currency": "NGN", "interval": "monthly"},
    }


def _active_subscription(user: User, next_payment_days: int = 30) -> dict:
    return {
        "subscription_code": "SUB_test",
        "email_token": "email_token_test",
        "status": "active",
        "next_payment_date": (
            datetime.now(timezone.utc) + timedelta(days=next_payment_days)
        ).isoformat(),
        "customer": {"id": _customer_id(user), "email": user.email},
        "plan": {"amount": 943700, "currency": "NGN", "interval": "monthly"},
    }


class TestSubscription:
    """Subscription tier tests (each uses a dedicated user for isolation)."""

    @pytest.mark.asyncio
    async def test_upgrade_requires_paystack_configuration(self, client: AsyncClient, monkeypatch):
        """Upgrade fails clearly when Paystack keys are not configured."""
        import app.api.routes.auth as auth_routes

        monkeypatch.setattr(auth_routes, "is_configured", lambda: False)
        headers = await _register(client, "upgrade@example.com")
        response = await client.post("/api/auth/upgrade", json={}, headers=headers)

        assert response.status_code == 503
        assert response.json()["detail"]["code"] == "SERVICE_UNAVAILABLE"

    @pytest.mark.asyncio
    async def test_upgrade_initializes_checkout_and_stores_reference(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        """A checkout stores the pending reference for later reconciliation."""
        import app.api.routes.auth as auth_routes

        async def fake_initialize(**kwargs):
            return {
                "authorization_url": "https://checkout.paystack.com/test",
                "access_code": "access_test",
                "reference": "ref_pending",
            }

        monkeypatch.setattr(auth_routes, "initialize_transaction", fake_initialize)
        headers = await _register(client, "checkout@example.com")

        response = await client.post(
            "/api/auth/upgrade",
            json={"callback_url": "http://localhost:5175/payment/callback"},
            headers=headers,
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["authorization_url"] == "https://checkout.paystack.com/test"
        user = await _user_by_email(db_session, "checkout@example.com")
        assert user.paystack_reference == "ref_pending"
        assert user.is_paid is False

    @pytest.mark.asyncio
    async def test_upgrade_already_premium_rejected(self, client: AsyncClient, premium_auth_headers):
        """Premium users cannot start another checkout."""
        response = await client.post("/api/auth/upgrade", json={}, headers=premium_auth_headers)

        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "INVALID_REQUEST"

    @pytest.mark.asyncio
    async def test_upgrade_requires_auth(self, client: AsyncClient):
        """Upgrade without a token is unauthorized."""
        response = await client.post("/api/auth/upgrade", json={})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_requires_auth(self, client: AsyncClient):
        """Payment verification without a token is unauthorized."""
        response = await client.get("/api/auth/upgrade/verify", params={"reference": "ref_123"})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_activates_premium_and_stores_subscription(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        """A successful verification unlocks premium without a webhook."""
        import app.api.routes.auth as auth_routes
        import app.services.subscription as subscription_service

        headers = await _register(client, "verify@example.com")
        user = await _user_by_email(db_session, "verify@example.com")

        async def fake_verify(reference):
            return _successful_transaction(user)

        async def fake_list(customer):
            return [_active_subscription(user)]

        monkeypatch.setattr(auth_routes, "verify_transaction", fake_verify)
        monkeypatch.setattr(subscription_service, "list_subscriptions", fake_list)

        response = await client.get(
            "/api/auth/upgrade/verify", params={"reference": "ref_test"}, headers=headers
        )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["tier"] == "premium"
        await db_session.refresh(user)
        assert user.is_paid is True
        assert user.paystack_subscription_id == "SUB_test"
        assert user.paystack_email_token == "email_token_test"

    @pytest.mark.asyncio
    async def test_verify_rejects_foreign_payment(self, client: AsyncClient, monkeypatch):
        """A transaction that belongs to another account is rejected."""
        import app.api.routes.auth as auth_routes

        headers = await _register(client, "foreign@example.com")

        async def fake_verify(reference):
            return {
                "status": "success",
                "reference": reference,
                "amount": 943700,
                "currency": "NGN",
                "metadata": {"user_id": "00000000-0000-0000-0000-000000000000"},
                "customer": {"id": 999, "email": "someone-else@example.com"},
                "plan": {"amount": 943700, "currency": "NGN", "interval": "monthly"},
            }

        monkeypatch.setattr(auth_routes, "verify_transaction", fake_verify)
        response = await client.get(
            "/api/auth/upgrade/verify", params={"reference": "ref_test"}, headers=headers
        )

        assert response.status_code == 403
        assert response.json()["detail"]["code"] == "INSUFFICIENT_PERMISSIONS"

    @pytest.mark.asyncio
    async def test_pending_reference_reconciled_on_status(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        """A paid but unseen checkout is reconciled when status is fetched."""
        import app.services.subscription as subscription_service

        headers = await _register(client, "reconcile@example.com")
        user = await _user_by_email(db_session, "reconcile@example.com")
        user.paystack_reference = "ref_pending"
        db_session.add(user)
        await db_session.commit()

        async def fake_verify(reference):
            return _successful_transaction(user)

        async def fake_list(customer):
            return [_active_subscription(user)]

        monkeypatch.setattr(subscription_service, "verify_transaction", fake_verify)
        monkeypatch.setattr(subscription_service, "list_subscriptions", fake_list)

        response = await client.get("/api/auth/subscription", headers=headers)

        assert response.status_code == 200
        assert response.json()["data"]["tier"] == "premium"

    @pytest.mark.asyncio
    async def test_reconciliation_rejects_underpaid_transaction(
        self, client: AsyncClient, db_session, monkeypatch
    ):
        """A pending checkout that paid less than the plan price is not applied."""
        import app.services.subscription as subscription_service

        headers = await _register(client, "underpaid@example.com")
        user = await _user_by_email(db_session, "underpaid@example.com")
        user.paystack_reference = "ref_underpaid"
        db_session.add(user)
        await db_session.commit()

        transaction = _successful_transaction(user, amount=1000)
        transaction["plan"]["amount"] = 943700

        async def fake_verify(reference):
            return transaction

        monkeypatch.setattr(subscription_service, "verify_transaction", fake_verify)

        response = await client.get("/api/auth/subscription", headers=headers)

        assert response.status_code == 200
        assert response.json()["data"]["tier"] == "free"
        await db_session.refresh(user)
        assert user.is_paid is False

    @pytest.mark.asyncio
    async def test_expired_subscription_downgrades_when_plan_is_gone(
        self, client: AsyncClient, db_session, premium_user, premium_auth_headers, monkeypatch
    ):
        """An expired subscription with no active Paystack plan becomes free."""
        import app.services.subscription as subscription_service

        premium_user.subscription_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db_session.add(premium_user)
        await db_session.commit()

        async def fake_list(customer):
            return []

        monkeypatch.setattr(subscription_service, "list_subscriptions", fake_list)
        response = await client.get("/api/auth/subscription", headers=premium_auth_headers)

        assert response.status_code == 200
        assert response.json()["data"]["tier"] == "free"
        await db_session.refresh(premium_user)
        assert premium_user.is_paid is False

    @pytest.mark.asyncio
    async def test_expired_subscription_stays_premium_when_plan_active(
        self, client: AsyncClient, db_session, premium_user, premium_auth_headers, monkeypatch
    ):
        """An auto-renewed subscription stays premium past the stored expiry."""
        import app.services.subscription as subscription_service

        premium_user.subscription_expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db_session.add(premium_user)
        await db_session.commit()

        async def fake_list(customer):
            return [_active_subscription(premium_user)]

        monkeypatch.setattr(subscription_service, "list_subscriptions", fake_list)
        response = await client.get("/api/auth/subscription", headers=premium_auth_headers)

        assert response.status_code == 200
        assert response.json()["data"]["tier"] == "premium"

    @pytest.mark.asyncio
    async def test_subscription_not_renew_keeps_access(
        self, client: AsyncClient, db_session, premium_user, monkeypatch
    ):
        """'not_renew' keeps premium until the period actually ends."""
        import app.api.routes.auth as auth_routes

        monkeypatch.setattr(auth_routes, "verify_webhook_signature", lambda *a, **k: True)
        subscription = _active_subscription(premium_user)
        subscription["status"] = "non-renewing"

        response = await client.post(
            "/api/auth/paystack/webhook",
            json={"event": "subscription.not_renew", "data": subscription},
        )

        assert response.status_code == 200
        await db_session.refresh(premium_user)
        assert premium_user.is_paid is True

    @pytest.mark.asyncio
    async def test_subscription_disable_downgrades(
        self, client: AsyncClient, db_session, premium_user, monkeypatch
    ):
        """'subscription.disable' revokes premium immediately."""
        import app.api.routes.auth as auth_routes

        monkeypatch.setattr(auth_routes, "verify_webhook_signature", lambda *a, **k: True)
        subscription = _active_subscription(premium_user)

        response = await client.post(
            "/api/auth/paystack/webhook",
            json={"event": "subscription.disable", "data": subscription},
        )

        assert response.status_code == 200
        await db_session.refresh(premium_user)
        assert premium_user.is_paid is False

    @pytest.mark.asyncio
    async def test_cancel_without_paystack_subscription(
        self, client: AsyncClient, premium_auth_headers, monkeypatch
    ):
        """Cancelling without any Paystack subscription is rejected."""
        import app.services.subscription as subscription_service

        async def fake_list(customer):
            return []

        monkeypatch.setattr(subscription_service, "list_subscriptions", fake_list)
        response = await client.post("/api/auth/cancel", headers=premium_auth_headers)

        assert response.status_code == 400
        assert response.json()["detail"]["code"] == "INVALID_REQUEST"

    @pytest.mark.asyncio
    async def test_cancel_looks_up_subscription_without_webhook(
        self, client: AsyncClient, db_session, premium_user, premium_auth_headers, monkeypatch
    ):
        """Cancel finds the plan on demand when no webhook stored its IDs."""
        import app.api.routes.auth as auth_routes
        import app.services.subscription as subscription_service

        async def fake_list(customer):
            return [_active_subscription(premium_user)]

        async def fake_disable(code, token):
            return {}

        monkeypatch.setattr(subscription_service, "list_subscriptions", fake_list)
        monkeypatch.setattr(auth_routes, "disable_subscription", fake_disable)

        response = await client.post("/api/auth/cancel", headers=premium_auth_headers)

        assert response.status_code == 200
        assert response.json()["data"]["tier"] == "free"
        await db_session.refresh(premium_user)
        assert premium_user.is_paid is False

    @pytest.mark.asyncio
    async def test_cancel_requires_auth(self, client: AsyncClient):
        """Cancel without a token is unauthorized."""
        response = await client.post("/api/auth/cancel")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_status_reflects_free_tier(self, client: AsyncClient):
        """Subscription status reports free limits for a new user."""
        headers = await _register(client, "statuscheck@example.com")
        response = await client.get("/api/auth/subscription", headers=headers)

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["tier"] == "free"
        assert data["question_limit"] == 10
        assert data["questions_remaining"] >= 0
