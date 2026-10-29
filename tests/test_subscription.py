"""Test subscription (upgrade/cancel/status) endpoints."""
import pytest
from httpx import AsyncClient


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


class TestSubscription:
    """Subscription tier tests (each uses a dedicated user for isolation)."""

    @pytest.mark.asyncio
    async def test_direct_upgrade_is_disabled(self, client: AsyncClient):
        """The old demo upgrade must not grant premium without payment."""
        headers = await _register(client, "upgrade@example.com")
        response = await client.post("/api/auth/upgrade", json={"plan": "premium"}, headers=headers)

        assert response.status_code == 410
        assert response.json()["detail"]["code"] == "INVALID_REQUEST"

    @pytest.mark.asyncio
    async def test_upgrade_requires_auth(self, client: AsyncClient):
        """Upgrade without a token is unauthorized."""
        response = await client.post("/api/auth/upgrade", json={"plan": "premium"})

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_cancel_returns_to_free(self, client: AsyncClient, premium_auth_headers):
        """Premium user can cancel back to the free tier."""
        response = await client.post("/api/auth/cancel", headers=premium_auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["tier"] == "free"
        assert data["data"]["is_paid"] is False
        assert data["data"]["question_limit"] == 10

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
