import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool

# Use PostgreSQL in production, SQLite for local development
DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    # Railway provides postgres:// but SQLAlchemy needs postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
    elif DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    engine = create_async_engine(DATABASE_URL, echo=False)
else:
    # Local development with SQLite - use StaticPool for better async handling
    DATABASE_URL = "sqlite+aiosqlite:///./byh_app.db"
    engine = create_async_engine(
        DATABASE_URL, 
        echo=False,  # Disable SQL echo for performance
        connect_args={"check_same_thread": False, "timeout": 30},
        poolclass=StaticPool,  # Single connection pool for SQLite
    )

AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
