# ========================================
# STOCKTECH - Database Configuration (Local PostgreSQL)
# ========================================

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, AsyncEngine
from sqlalchemy.orm import sessionmaker

from .config import settings

# Create async engine with local PostgreSQL
engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,  # Log SQL queries in debug mode
    pool_size=settings.database_pool_size,
    max_overflow=settings.database_max_overflow,
    pool_timeout=settings.database_pool_timeout,
    pool_pre_ping=True,  # Validate connections before use
)

# Create async session factory
AsyncSessionFactory = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=True,
    autocommit=False
)

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Database session dependency for FastAPI
    
    Usage:
        @app.get("/products")
        async def get_products(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Product))
            return result.scalars().all()
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

async def init_database():
    """
    Initialize database connection and test connectivity
    Called during application startup
    """
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            # Test connection
            await conn.execute(text("SELECT 1"))
            print("✅ Connected to StockTech PostgreSQL successfully")
            
            # Check if database has been initialized
            result = await conn.execute(
                text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'")
            )
            table_count = result.scalar()
            
            if table_count == 0:
                print("📊 Empty database detected - ready for migrations")
            else:
                print(f"📊 Database has {table_count} tables")
            
    except Exception as e:
        print(f"❌ Failed to connect to StockTech PostgreSQL: {str(e)}")
        raise

async def close_database():
    """
    Close database connections
    Called during application shutdown
    """
    await engine.dispose()
    print("🔌 Disconnected from StockTech PostgreSQL")

# Export for convenience
__all__ = [
    "engine",
    "AsyncSessionFactory", 
    "get_db",
    "init_database",
    "close_database"
]