"""Test authentication endpoints."""
import pytest
from httpx import AsyncClient


class TestAuth:
    """Authentication tests."""
    
    @pytest.mark.asyncio
    async def test_register(self, client: AsyncClient):
        """Test user registration."""
        response = await client.post("/api/auth/register", json={
            "email": "newuser@example.com",
            "password": "password123",
            "full_name": "New User"
        })
        
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert "refresh_token" in data["data"]
        assert data["data"]["user"]["email"] == "newuser@example.com"
    
    @pytest.mark.asyncio
    async def test_register_duplicate_email(self, client: AsyncClient, test_user):
        """Test registration with existing email."""
        response = await client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
        })
        
        assert response.status_code == 400
        data = response.json()
        assert data["detail"]["code"] == "INVALID_REQUEST"
    
    @pytest.mark.asyncio
    async def test_login(self, client: AsyncClient, test_user):
        """Test user login."""
        response = await client.post("/api/auth/login", data={
            "username": "test@example.com",
            "password": "testpassword123"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert data["data"]["user"]["email"] == "test@example.com"
    
    @pytest.mark.asyncio
    async def test_login_invalid_credentials(self, client: AsyncClient, test_user):
        """Test login with wrong password."""
        response = await client.post("/api/auth/login", data={
            "username": "test@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        data = response.json()
        assert data["detail"]["code"] == "INVALID_TOKEN"
    
    @pytest.mark.asyncio
    async def test_refresh_token(self, client: AsyncClient, test_user, auth_headers):
        """Test token refresh."""
        # First login to get refresh token
        login_response = await client.post("/api/auth/login", data={
            "username": "test@example.com",
            "password": "testpassword123"
        })
        refresh_token = login_response.json()["data"]["refresh_token"]
        
        response = await client.post("/api/auth/refresh", json={
            "refresh_token": refresh_token
        })
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
    
    @pytest.mark.asyncio
    async def test_get_me(self, client: AsyncClient, auth_headers):
        """Get current user info."""
        response = await client.get("/api/auth/me", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == "test@example.com"
    
    @pytest.mark.asyncio
    async def test_get_me_unauthorized(self, client: AsyncClient):
        """Get current user without auth."""
        response = await client.get("/api/auth/me")
        
        assert response.status_code == 401
    
    @pytest.mark.asyncio
    async def test_subscription_status_free(self, client: AsyncClient, auth_headers):
        """Get subscription status for free user."""
        response = await client.get("/api/auth/subscription", headers=auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["tier"] == "free"
        assert data["data"]["is_paid"] is False
        assert data["data"]["question_limit"] == 10
    
    @pytest.mark.asyncio
    async def test_subscription_status_premium(self, client: AsyncClient, premium_auth_headers):
        """Get subscription status for premium user."""
        response = await client.get("/api/auth/subscription", headers=premium_auth_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["tier"] == "premium"
        assert data["data"]["is_paid"] is True
        assert data["data"]["question_limit"] == 50