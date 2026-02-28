# ========================================
# STOCKTECH - Configuration Settings
# ========================================

import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    """Application settings for StockTech"""
    
    # ========================================
    # DATABASE CONFIGURATION (LOCAL)
    # ========================================
    
    # Local PostgreSQL connection  
    database_url: str = Field(
        default="postgresql+asyncpg://stocktech_user:stocktech_secure_password_2024@localhost:5433/stocktech",
        env="STOCKTECH_DATABASE_URL",
        description="Local PostgreSQL connection string"
    )
    
    # Database pool settings
    database_pool_size: int = Field(default=10, env="DATABASE_POOL_SIZE")
    database_max_overflow: int = Field(default=20, env="DATABASE_MAX_OVERFLOW")
    database_pool_timeout: int = Field(default=30, env="DATABASE_POOL_TIMEOUT")
    
    # ========================================
    # REDIS CONFIGURATION
    # ========================================
    
    redis_url: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    redis_password: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    
    # ========================================
    # JWT & SECURITY
    # ========================================
    
    jwt_secret: str = Field(
        default="dev-super-secret-key-change-in-production-256-bits",
        env="JWT_SECRET"
    )
    jwt_expire_days: int = Field(default=7, env="JWT_EXPIRE_DAYS")
    jwt_algorithm: str = Field(default="HS256", env="JWT_ALGORITHM")
    
    # ========================================
    # WHATSAPP MARKETPLACE INTEGRATION
    # ========================================
    
    whatsapp_default_number: str = Field(default="5511999999999", env="WHATSAPP_DEFAULT_NUMBER")
    whatsapp_api_token: Optional[str] = Field(default=None, env="WHATSAPP_API_TOKEN")
    whatsapp_business_account_id: Optional[str] = Field(default=None, env="WHATSAPP_BUSINESS_ACCOUNT_ID")
    whatsapp_phone_number_id: Optional[str] = Field(default=None, env="WHATSAPP_PHONE_NUMBER_ID")
    
    # ========================================
    # AVADMIN COMMUNICATION
    # ========================================
    
    avadmin_api_url: str = Field(
        default="http://avadmin-backend:8000",
        env="AVADMIN_API_URL",
        description="AvAdmin backend URL for inter-module communication"
    )
    
    # ========================================
    # FILE UPLOAD SETTINGS
    # ========================================
    
    max_upload_size: int = Field(default=10485760, env="MAX_UPLOAD_SIZE")  # 10MB
    allowed_extensions: List[str] = Field(
        default=["jpg", "jpeg", "png", "gif", "webp"],
        env="ALLOWED_EXTENSIONS"
    )
    upload_path: str = Field(default="./uploads", env="UPLOAD_PATH")
    
    # Image processing
    image_max_width: int = Field(default=2048, env="IMAGE_MAX_WIDTH")
    image_max_height: int = Field(default=2048, env="IMAGE_MAX_HEIGHT")
    image_quality: int = Field(default=85, env="IMAGE_QUALITY")
    thumbnail_size: int = Field(default=300, env="THUMBNAIL_SIZE")
    
    # ========================================
    # APPLICATION SETTINGS
    # ========================================
    
    app_name: str = Field(default="StockTech", env="APP_NAME")
    app_version: str = Field(default="1.0.0", env="APP_VERSION")
    environment: str = Field(default="development", env="ENVIRONMENT")
    debug: bool = Field(default=True, env="DEBUG")
    
    # ========================================
    # CORS SETTINGS
    # ========================================
    
    cors_origins: List[str] = Field(
        default=[
            "http://localhost:3002",
            "http://localhost:3000",
            "https://stocktech.avelarcompany.com.br",
            "https://avelarcompany.com.br"
        ],
        env="CORS_ORIGINS"
    )
    
    # ========================================
    # RATE LIMITING
    # ========================================
    
    rate_limit_per_minute: int = Field(default=2000, env="RATE_LIMIT_PER_MINUTE")  # Higher for marketplace
    rate_limit_burst: int = Field(default=200, env="RATE_LIMIT_BURST")
    
    # ========================================
    # SEARCH & CATALOG
    # ========================================
    
    # Pagination defaults
    default_page_size: int = Field(default=20, env="DEFAULT_PAGE_SIZE")
    max_page_size: int = Field(default=100, env="MAX_PAGE_SIZE")
    
    # Search settings
    search_min_chars: int = Field(default=3, env="SEARCH_MIN_CHARS")
    
    # ========================================
    # VALIDATION
    # ========================================
    
    @property
    def is_production(self) -> bool:
        """Check if running in production"""
        return self.environment.lower() == "production"
    
    @property
    def database_url_sync(self) -> str:
        """Get synchronous database URL (for Alembic)"""
        return self.database_url.replace("+asyncpg", "")
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False
    }

# Global settings instance
settings = Settings()