# ========================================
# STOCKTECH - Category & Brand Models
# ========================================

from typing import Optional

from sqlalchemy import Boolean, Column, String, Text, Integer
from sqlalchemy.orm import relationship

from .base import Base

class Category(Base):
    """
    Product category model
    Organizes products into hierarchical categories
    """
    __tablename__ = "categories"
    
    # Basic Information
    name = Column(String(50), unique=True, nullable=False, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)  # URL-friendly
    description = Column(Text, nullable=True)
    
    # Display Settings
    icon = Column(String(50), nullable=True)           # Icon class/name
    color = Column(String(7), default="#6B7280", nullable=False)  # Hex color
    image_url = Column(String(500), nullable=True)     # Category image
    
    # Hierarchy (simple parent-child)
    parent_id = Column(String, nullable=True, index=True)  # Self-reference for subcategories
    
    # SEO and Display
    meta_title = Column(String(100), nullable=True)
    meta_description = Column(String(200), nullable=True)
    display_order = Column(Integer, default=0, nullable=False)
    
    # Status
    is_active = Column(Boolean, default=True, nullable=False)
    is_featured = Column(Boolean, default=False, nullable=False)
    
    # Analytics
    product_count = Column(Integer, default=0, nullable=False)  # Cached count
    
    # Relationships (will be defined after all models are loaded)
    # products = relationship("Product", back_populates="category")
    
    def __repr__(self):
        return f"<Category {self.name}>"
    
    @property
    def is_parent_category(self) -> bool:
        """Check if this is a parent category"""
        return self.parent_id is None
    
    def update_product_count(self, db_session):
        """Update cached product count"""
        from .product import Product, ProductStatus
        
        count = db_session.query(Product).filter(
            Product.category_id == self.id,
            Product.status == ProductStatus.ACTIVE
        ).count()
        
        self.product_count = count

class Brand(Base):
    """
    Product brand model
    Represents product manufacturers/brands
    """
    __tablename__ = "brands"
    
    # Basic Information
    name = Column(String(50), unique=True, nullable=False, index=True)
    slug = Column(String(50), unique=True, nullable=False, index=True)  # URL-friendly
    description = Column(Text, nullable=True)
    
    # Brand Assets
    logo_url = Column(String(500), nullable=True)      # Brand logo
    website_url = Column(String(200), nullable=True)   # Official website
    
    # Brand Info
    country_origin = Column(String(2), nullable=True)   # Country code (BR, US, CN)
    founded_year = Column(Integer, nullable=True)
    
    # Display Settings
    is_active = Column(Boolean, default=True, nullable=False)
    is_premium = Column(Boolean, default=False, nullable=False)  # Premium brand badge
    display_order = Column(Integer, default=0, nullable=False)
    
    # SEO
    meta_title = Column(String(100), nullable=True)
    meta_description = Column(String(200), nullable=True)
    
    # Analytics
    product_count = Column(Integer, default=0, nullable=False)  # Cached count
    
    # Relationships (will be defined after all models are loaded)
    # products = relationship("Product", back_populates="brand")
    
    def __repr__(self):
        return f"<Brand {self.name}>"
    
    def update_product_count(self, db_session):
        """Update cached product count"""
        from .product import Product, ProductStatus
        
        count = db_session.query(Product).filter(
            Product.brand_id == self.id,
            Product.status == ProductStatus.ACTIVE
        ).count()
        
        self.product_count = count