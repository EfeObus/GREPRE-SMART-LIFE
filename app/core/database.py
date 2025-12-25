"""
GrePre Smart Life - Database Configuration
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base

from app.core.config import settings

logger = logging.getLogger("grepre.database")

engine = create_async_engine(
    settings.database_url, 
    echo=settings.debug, 
    future=True,
    pool_pre_ping=True,       # Verify connections before using
    pool_recycle=300,         # Recycle connections every 5 minutes
    pool_timeout=10,          # Wait max 10 seconds for connection
    connect_args={
        "timeout": 10,        # Connection timeout 10 seconds
    }
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db(retries: int = 2, delay: int = 1):
    """Initialize database with retry logic for cloud deployments."""
    for attempt in range(retries):
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            return
        except Exception as e:
            logger.warning(f"Database connection attempt {attempt + 1}/{retries} failed: {e}")
            if attempt < retries - 1:
                await asyncio.sleep(delay)
            else:
                raise

