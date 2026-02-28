# ========================================
# STOCKTECH - Models Package
# ========================================

from .base import Base
from .product import Product, ProductStatus, ProductCondition
from .category import Category, Brand
from .transaction import Transaction, TransactionStatus, TransactionType

# Export all models for easy importing
__all__ = [
    # Base
    "Base",
    
    # Product models
    "Product",
    "ProductStatus", 
    "ProductCondition",
    
    # Category models
    "Category",
    "Brand",
    
    # Transaction models
    "Transaction",
    "TransactionStatus",
    "TransactionType",
]

# Model registry for migrations and other tools
MODELS = [
    Category,
    Brand,
    Product,
    Transaction,
]