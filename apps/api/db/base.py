from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_size=10,
    max_overflow=20,
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# Base class for models
class Base(DeclarativeBase):
    pass


# Dependency for getting database session
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db():
    """Initialize database (create tables if needed)"""
    # Import models to register them
    from db import models  # noqa: F401

    # Note: In production, use Alembic migrations instead
    # This is just for development convenience
    # async with engine.begin() as conn:
    #     await conn.run_sync(Base.metadata.create_all)
