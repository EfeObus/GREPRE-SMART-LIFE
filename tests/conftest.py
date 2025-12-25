"""
GrePre Smart Life - Test Configuration and Fixtures
"""

import asyncio
import os
from datetime import date, timedelta
from typing import AsyncGenerator, Generator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Set test environment before importing app - DISABLE RATE LIMITING
os.environ["APP_ENV"] = "test"
os.environ["DEBUG"] = "false"
os.environ["SECRET_KEY"] = "test_secret_key_for_testing_only"
os.environ["JWT_SECRET"] = "test_jwt_secret_for_testing_only"
os.environ["DISABLE_RATE_LIMIT"] = "true"

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models import Bill, BillCategory, BillFrequency, BillStatus, User

# Use the same database URL from settings (PostgreSQL)
TEST_DATABASE_URL = os.environ.get("DATABASE_URL", settings.database_url)


@pytest.fixture(scope="session")
def event_loop() -> Generator:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def async_engine():
    """Create async engine for tests using PostgreSQL."""
    engine = create_async_engine(
        TEST_DATABASE_URL,
        echo=False,
    )

    # Create all tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Clean up tables after each test (truncate instead of drop for speed)
    async with engine.begin() as conn:
        # Get all table names and truncate them
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(text(f'TRUNCATE TABLE "{table.name}" CASCADE'))

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(async_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create a single shared session for tests."""
    session_maker = async_sessionmaker(
        async_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autocommit=False,
        autoflush=False,
    )

    async with session_maker() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with database override using shared session."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user using the shared session."""
    user = User(
        email="testuser@example.com",
        hashed_password=get_password_hash("TestPassword123!"),
        full_name="Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
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
async def test_bill(db_session: AsyncSession, test_user: User) -> Bill:
    """Create a test bill using the shared session."""
    bill = Bill(
        name="Test Bill",
        amount=100.50,
        due_date=date.today() + timedelta(days=7),
        category=BillCategory.OTHER,
        frequency=BillFrequency.MONTHLY,
        status=BillStatus.PENDING,
        user_id=test_user.id,
        is_auto_pay=False,
        is_deleted=False,
    )
    db_session.add(bill)
    await db_session.commit()
    await db_session.refresh(bill)
    return bill


# Test data factories
class TestDataFactory:
    """Factory for creating test data."""

    @staticmethod
    def user_data(
        email: str = "newuser@example.com",
        password: str = "SecurePass123!",
        full_name: str = "New User",
    ) -> dict:
        return {
            "email": email,
            "password": password,
            "full_name": full_name,
        }

    @staticmethod
    def bill_data(
        name: str = "New Bill",
        amount: float = 50.00,
        category: str = "other",
    ) -> dict:
        return {
            "name": name,
            "amount": amount,
            "due_date": (date.today() + timedelta(days=14)).isoformat(),
            "category": category,
            "frequency": "monthly",
            "is_auto_pay": False,
        }


@pytest.fixture
def factory() -> TestDataFactory:
    """Provide test data factory."""
    return TestDataFactory()
