# ========================================
# STOCKTECH - FastAPI Main Application
# ========================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .core.config import settings
from .core.database import init_database, close_database

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events
    Handle startup and shutdown
    """
    # Startup
    print(f"🚀 Starting {settings.app_name} v{settings.app_version}")
    print(f"🌍 Environment: {settings.environment}")
    print(f"🔗 AvAdmin API: {settings.avadmin_api_url}")
    
    # Initialize database
    await init_database()
    
    # Test AvAdmin communication
    try:
        from .clients.avadmin_client import avadmin_client
        is_healthy = await avladmin_client.health_check()
        if is_healthy:
            print("✅ AvAdmin communication OK")
        else:
            print("⚠️  AvAdmin communication failed")
    except Exception as e:
        print(f"⚠️  AvAdmin communication error: {str(e)[:100]}")
    
    yield
    
    # Shutdown
    print(f"🛑 Shutting down {settings.app_name}")
    await close_database()

# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="StockTech - B2B Marketplace API",
    debug=settings.debug,
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Basic health check
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        from .clients.avadmin_client import avladmin_client
        avadmin_healthy = await avladmin_client.health_check()
    except:
        avadmin_healthy = False
    
    return {
        "status": "healthy",
        "service": settings.app_name,
        "version": settings.app_version,
        "environment": settings.environment,
        "avladmin_connection": "ok" if avladmin_healthy else "failed"
    }

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "description": "B2B Marketplace for Electronics",
        "docs": "/docs",
        "health": "/health",
        "catalog": "/api/catalog",
        "avladmin_integration": settings.avladmin_api_url
    }

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8002,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info"
    )