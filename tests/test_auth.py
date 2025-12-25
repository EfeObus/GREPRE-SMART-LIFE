"""
GrePre Smart Life - Authentication Tests
"""

import pytest
from httpx import AsyncClient


class TestHealthEndpoints:
    """Test health check endpoints."""

    @pytest.mark.asyncio
    async def test_health_basic(self, client: AsyncClient):
        """Test basic health endpoint."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data

    @pytest.mark.asyncio
    async def test_health_live(self, client: AsyncClient):
        """Test liveness probe endpoint."""
        response = await client.get("/health/live")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "alive"
        assert "uptime_seconds" in data


class TestRegistration:
    """Test user registration."""

    @pytest.mark.asyncio
    async def test_register_success(self, client: AsyncClient, factory):
        """Test successful user registration."""
        user_data = factory.user_data()
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code in [200, 201]
        data = response.json()
        assert data["success"] is True
        assert "user" in data["data"]
        assert data["data"]["user"]["email"] == user_data["email"]

    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient, factory):
        """Test registration with weak password fails."""
        user_data = factory.user_data(password="123")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_register_duplicate_email(
        self, client: AsyncClient, test_user, factory
    ):
        """Test registration with existing email fails."""
        user_data = factory.user_data(email=test_user.email)
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code in [400, 409]
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client: AsyncClient, factory):
        """Test registration with invalid email fails."""
        user_data = factory.user_data(email="not-an-email")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 422  # Validation error


class TestLogin:
    """Test user login."""

    @pytest.mark.asyncio
    async def test_login_success(self, client: AsyncClient, test_user):
        """Test successful login."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "TestPassword123!",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "access_token" in data["data"]
        assert data["data"]["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_wrong_password(self, client: AsyncClient, test_user):
        """Test login with wrong password fails."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "WrongPassword123!",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with nonexistent user fails."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123!",
            },
        )
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False


class TestProtectedEndpoints:
    """Test protected endpoint access."""

    @pytest.mark.asyncio
    async def test_access_without_token(self, client: AsyncClient):
        """Test accessing protected endpoint without token fails."""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_with_invalid_token(self, client: AsyncClient):
        """Test accessing protected endpoint with invalid token fails."""
        client.headers["Authorization"] = "Bearer invalid_token"
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_with_valid_token(
        self, authenticated_client: AsyncClient, test_user
    ):
        """Test accessing protected endpoint with valid token succeeds."""
        response = await authenticated_client.get("/api/v1/users/me")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["email"] == test_user.email


class TestPasswordValidation:
    """Test password strength validation."""

    @pytest.mark.asyncio
    async def test_password_too_short(self, client: AsyncClient, factory):
        """Test password that is too short."""
        user_data = factory.user_data(password="Short1!")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_no_uppercase(self, client: AsyncClient, factory):
        """Test password without uppercase."""
        user_data = factory.user_data(password="lowercase123!")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_no_lowercase(self, client: AsyncClient, factory):
        """Test password without lowercase."""
        user_data = factory.user_data(password="UPPERCASE123!")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_no_digit(self, client: AsyncClient, factory):
        """Test password without digit."""
        user_data = factory.user_data(password="NoDigitsHere!")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_no_special(self, client: AsyncClient, factory):
        """Test password without special character."""
        user_data = factory.user_data(password="NoSpecial123")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_password_common_password(self, client: AsyncClient, factory):
        """Test common password is rejected."""
        user_data = factory.user_data(password="Password123!")
        response = await client.post("/api/v1/auth/register", json=user_data)
        assert response.status_code == 400
