# ========================================
# STOCKTECH - Product Models (Marketplace)
# ========================================

import enum
from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base

class ProductStatus(str, enum.Enum):
    """Product status in the marketplace"""
    DRAFT = "draft"                  # Not published yet
    ACTIVE = "active"                # Active and visible
    INACTIVE = "inactive"            # Hidden from catalog
    OUT_OF_STOCK = "out_of_stock"    # No stock available
    RESERVED = "reserved"            # Product reserved for buyer

class ProductCondition(str, enum.Enum):
    """Product condition"""
    NEW = "new"                      # Brand new
    USED_EXCELLENT = "used_excellent"  # Used but excellent condition
    USED_GOOD = "used_good"          # Used but good condition
    USED_FAIR = "used_fair"          # Used with some wear
    REFURBISHED = "refurbished"      # Professionally refurbished

class Product(Base):
    """
    Product model - Marketplace products
    Note: user_id and account_id reference AvAdmin (no FK constraint)
    """
    __tablename__ = "products"
    
    # References to AvAdmin (no FK - microservices)
    account_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Company
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)     # Owner/Seller
    
    # Product Identity
    code = Column(String(20), unique=True, nullable=False, index=True)   # ST123456A
    name = Column(String(200), nullable=False, index=True)
    description = Column(Text, nullable=True)
    
    # Categorization
    category_id = Column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    brand_id = Column(
        UUID(as_uuid=True),
        ForeignKey("brands.id", ondelete="SET NULL"),
        nullable=True,
        index=True
    )
    
    # Pricing and Stock
    price = Column(Numeric(10, 2), nullable=False, index=True)
    original_price = Column(Numeric(10, 2), nullable=True)               # For discounts
    cost_price = Column(Numeric(10, 2), nullable=True)                   # Internal cost
    stock_quantity = Column(Integer, default=0, nullable=False)
    min_stock_alert = Column(Integer, default=5, nullable=False)
    
    # Product Details
    condition = Column(Enum(ProductCondition), default=ProductCondition.NEW, nullable=False)
    status = Column(Enum(ProductStatus), default=ProductStatus.DRAFT, nullable=False)
    
    # Technical Specifications (JSON for flexibility)
    specifications = Column(
        JSONB,
        default=dict,
        nullable=False,
        comment="""
        Product specifications:
        {
            "display": "6.1 inch OLED",
            "storage": "256GB",
            "color": "Space Gray",
            "warranty_months": 12,
            "dimensions": "146.7×71.5×7.65mm",
            "weight": "172g"
        }
        """
    )
    
    # Images (stored as JSON array of URLs)
    images = Column(
        JSONB,
        default=list,
        nullable=False,
        comment="""
        Product images:
        [
            {
                "url": "/uploads/products/image1.jpg",
                "thumbnail": "/uploads/products/thumb_image1.jpg",
                "alt": "iPhone front view",
                "is_primary": true,
                "order": 1
            }
        ]
        """
    )
    
    # SEO and Marketing
    slug = Column(String(250), nullable=True, index=True)                # URL-friendly name
    keywords = Column(String(500), nullable=True)                       # Search keywords
    is_featured = Column(Boolean, default=False, nullable=False)        # Featured product
    
    # Shipping and Location
    weight_kg = Column(Numeric(8, 3), nullable=True)                    # Weight in kg
    dimensions = Column(String(50), nullable=True)                      # LxWxH in cm
    shipping_required = Column(Boolean, default=True, nullable=False)
    
    # Marketplace Settings
    allows_negotiation = Column(Boolean, default=True, nullable=False)   # WhatsApp negotiation
    min_negotiation_price = Column(Numeric(10, 2), nullable=True)       # Minimum acceptable price
    
    # Analytics counters
    view_count = Column(Integer, default=0, nullable=False)
    contact_count = Column(Integer, default=0, nullable=False)           # WhatsApp clicks
    favorite_count = Column(Integer, default=0, nullable=False)
    
    # Internal flags
    is_imported = Column(Boolean, default=False, nullable=False)         # Bulk imported
    import_batch_id = Column(String(50), nullable=True, index=True)      # Import batch reference
    
    # Relationships (will be defined after all models are loaded)
    # category = relationship("Category", back_populates="products")
    # brand = relationship("Brand", back_populates="products")  
    # transactions = relationship("Transaction", back_populates="product", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Product {self.code}: {self.name}>"
    
    @property
    def price_formatted(self) -> str:
        """Return formatted price: R$ 8.500,00"""
        return f"R$ {self.price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    @property
    def is_on_sale(self) -> bool:
        """Check if product has discount"""
        return self.original_price and self.original_price > self.price
    
    @property
    def discount_percentage(self) -> float:
        """Calculate discount percentage"""
        if not self.is_on_sale:
            return 0.0
        return float(((self.original_price - self.price) / self.original_price) * 100)
    
    @property
    def is_in_stock(self) -> bool:
        """Check if product has stock"""
        return self.stock_quantity > 0
    
    @property
    def is_low_stock(self) -> bool:
        """Check if stock is below minimum alert"""
        return self.stock_quantity <= self.min_stock_alert
    
    @property
    def primary_image_url(self) -> Optional[str]:
        """Get primary image URL"""
        if not self.images:
            return None
        
        # Find primary image
        for image in self.images:
            if image.get("is_primary", False):
                return image.get("url")
        
        # Return first image if no primary found
        return self.images[0].get("url") if self.images else None
    
    @property
    def thumbnail_url(self) -> Optional[str]:
        """Get thumbnail URL"""
        if not self.images:
            return None
        
        # Find primary image thumbnail
        for image in self.images:
            if image.get("is_primary", False):
                return image.get("thumbnail", image.get("url"))
        
        # Return first image thumbnail
        first_image = self.images[0]
        return first_image.get("thumbnail", first_image.get("url"))
    
    def increment_view_count(self):
        """Increment view counter"""
        self.view_count += 1
    
    def increment_contact_count(self):
        """Increment contact counter (WhatsApp clicks)"""
        self.contact_count += 1
    
    def add_to_favorites(self):
        """Increment favorite counter"""
        self.favorite_count += 1
    
    def remove_from_favorites(self):
        """Decrement favorite counter"""
        if self.favorite_count > 0:
            self.favorite_count -= 1
    
    def update_stock(self, quantity: int, operation: str = "set"):
        """Update stock quantity"""
        if operation == "set":
            self.stock_quantity = max(0, quantity)
        elif operation == "add":
            self.stock_quantity += quantity
        elif operation == "subtract":
            self.stock_quantity = max(0, self.stock_quantity - quantity)
    
    def reserve_stock(self, quantity: int) -> bool:
        """Reserve stock for transaction (returns success)"""
        if self.stock_quantity >= quantity:
            self.stock_quantity -= quantity
            if self.stock_quantity == 0:
                self.status = ProductStatus.OUT_OF_STOCK
            return True
        return False
    
    def release_stock(self, quantity: int):
        """Release reserved stock"""
        self.stock_quantity += quantity
        if self.status == ProductStatus.OUT_OF_STOCK and self.stock_quantity > 0:
            self.status = ProductStatus.ACTIVE
    
    def get_whatsapp_message(self, buyer_name: Optional[str] = None) -> str:
        """Generate WhatsApp message template"""
        message = f"🔥 *{self.name}*\n"
        message += f"💰 Preço: {self.price_formatted}\n"
        message += f"📦 Código: {self.code}\n"
        
        if buyer_name:
            message += f"\nOlá! Sou {buyer_name} e tenho interesse neste produto.\n"
        else:
            message += f"\nOlá! Tenho interesse neste produto.\n"
        
        message += "Podemos negociar? 😊"
        
        return message
    
    def get_search_vector(self) -> str:
        """Get searchable text for full-text search"""
        parts = [
            self.name,
            self.description or "",
            self.code,
            " ".join(self.specifications.values()) if self.specifications else "",
        ]
        return " ".join(str(part) for part in parts if part)
    
    def to_marketplace_dict(self) -> Dict:
        """Convert to dictionary for marketplace API"""
        return {
            "id": str(self.id),
            "code": self.code,
            "name": self.name,
            "description": self.description,
            "price": float(self.price),
            "price_formatted": self.price_formatted,
            "original_price": float(self.original_price) if self.original_price else None,
            "is_on_sale": self.is_on_sale,
            "discount_percentage": self.discount_percentage,
            "condition": self.condition.value,
            "status": self.status.value,
            "is_in_stock": self.is_in_stock,
            "stock_quantity": self.stock_quantity,
            "primary_image": self.primary_image_url,
            "thumbnail": self.thumbnail_url,
            "images": self.images,
            "specifications": self.specifications,
            "category": self.category.name if self.category else None,
            "brand": self.brand.name if self.brand else None,
            "view_count": self.view_count,
            "allows_negotiation": self.allows_negotiation,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }