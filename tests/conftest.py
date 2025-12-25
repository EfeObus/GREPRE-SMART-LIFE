"""
GrePre Smart Life - Test Configuration and Fixtures
"""

import asyncio
import os
from datetime import datetime
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Set test environment before importing app
os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "false"
os.environ["SECRET_KEY"] = "test_secret_key_for_testing_only"
os.environ["JWT_SECRET"] = "test_jwt_secret_for_testing_only"

from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models import Bill, Category, User

# Test database URL (in-memory SQLite for fast tests)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create async engine for tests."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        echo=False,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create async session for tests."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with async_session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(async_engine) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with database override."""
    async_session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async def override_get_db():
        async with async_session_maker() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def test_user(async_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="testuser@example.com",
        password_hash=get_password_hash("TestPassword123!"),
        first_name="Test",
        last_name="User",
        is_active=True,
    )
    async_session.add(user)
    await async_session.commit()
    await async_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def test_user_token(test_user: User) -> str:
    """Create access token for test user."""
    return create_access_token(data={"sub": str(test_user.id)})


@pytest_asyncio.fixture(scope="function")
async def authenticated_client(
    client: AsyncClient, test_user_token: str
) -> AsyncClient:
    """Create authenticated test client."""
    client.headers["Authorization"] = f"Bearer {test_user_token}"
    return client


@pytest_asyncio.fixture(scope="function")
async def test_category(async_session: AsyncSession, test_user: User) -> Category:
    """Create a test category."""
    category = Category(
        name="Test Category",
        color="#FF5733",
        icon="folder",
        user_id=test_user.id,
    )
    async_session.add(category)
    await async_session.commit()
    await async_session.refresh(category)
    return category


@pytest_asyncio.fixture(scope="function")
async def test_bill(
    async_session: AsyncSession, test_user: User, test_category: Category
) -> Bill:
    """Create a test bill."""
    bill = Bill(
        name="Test Bill",
        amount=100.50,
        due_date=datetime.utcnow(),
        category_id=test_category.id,
        user_id=test_user.id,
        is_recurring=False,
        status="pending",
    )
    async_session.add(bill)
    await async_session.commit()
    await async_session.refresh(bill)
    return bill


# Test data factories
class TestDataFactory:
    """Factory for creating test data."""

    @staticmethod
    def user_data(
        email: str = "newuser@example.com",
        password: str = "SecurePass123!",
        first_name: str = "New",
        last_name: str = "User",
    ) -> dict:
        return {
            "email": email,
            "password": password,
            "first_name": first_name,
            "last_name": last_name,
        }

    @staticmethod
    def bill_data(
        name: str = "New Bill",
        amount: float = 50.00,
        category_id: str = None,
    ) -> dict:
        return {
            "name": name,
            "amount": amount,
            "due_date": datetime.utcnow().isoformat(),
            "category_id": category_id,
            "is_recurring": False,
        }

    @staticmethod
    def category_data(
        name: str = "New Category",
        color: str = "#3498DB",
    ) -> dict:
        return {
            "name": name,
            "color": color,
            "icon": "star",
        }


@pytest.fixture
def factory() -> TestDataFactory:
    """Provide test data factory."""
    return TestDataFactory()
