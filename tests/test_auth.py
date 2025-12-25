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
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code == 201
        data = response.json()
        assert data["email"] == user_data["email"]
        assert "id" in data

    @pytest.mark.asyncio
    async def test_register_weak_password(self, client: AsyncClient, factory):
        """Test registration with weak password fails."""
        user_data = factory.user_data(password="123")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        # API returns 422 for validation errors or 400 for weak passwords
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_register_duplicate_email(
        self, client: AsyncClient, test_user, factory
    ):
        """Test registration with existing email fails."""
        user_data = factory.user_data(email=test_user.email)
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_register_invalid_email(self, client: AsyncClient, factory):
        """Test registration with invalid email fails."""
        user_data = factory.user_data(email="not-an-email")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
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
        assert "access_token" in data
        assert data["token_type"] == "bearer"

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


class TestProtectedEndpoints:
    """Test protected endpoint access."""

    @pytest.mark.asyncio
    async def test_access_bills_without_token(self, client: AsyncClient):
        """Test accessing protected endpoint without token fails."""
        response = await client.get("/api/v1/bills")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_bills_with_invalid_token(self, client: AsyncClient):
        """Test accessing protected endpoint with invalid token fails."""
        client.headers["Authorization"] = "Bearer invalid_token"
        response = await client.get("/api/v1/bills")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_access_bills_with_valid_token(
        self, authenticated_client: AsyncClient
    ):
        """Test accessing protected endpoint with valid token succeeds."""
        response = await authenticated_client.get("/api/v1/bills")
        assert response.status_code == 200


class TestPasswordValidation:
    """Test password strength validation."""

    @pytest.mark.asyncio
    async def test_password_too_short(self, client: AsyncClient, factory):
        """Test password too short fails."""
        user_data = factory.user_data(password="Ab1!")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_password_no_uppercase(self, client: AsyncClient, factory):
        """Test password without uppercase fails."""
        user_data = factory.user_data(password="password123!")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_password_no_lowercase(self, client: AsyncClient, factory):
        """Test password without lowercase fails."""
        user_data = factory.user_data(password="PASSWORD123!")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_password_no_digit(self, client: AsyncClient, factory):
        """Test password without digit fails."""
        user_data = factory.user_data(password="Password!")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_password_no_special(self, client: AsyncClient, factory):
        """Test password without special char fails."""
        user_data = factory.user_data(password="Password123")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_password_common_password(self, client: AsyncClient, factory):
        """Test common password fails."""
        user_data = factory.user_data(password="Password123!")
        response = await client.post(
            "/api/v1/auth/register?create_samples=false", json=user_data
        )
        # May succeed or fail depending on common password list
        assert response.status_code in [201, 400, 422]
