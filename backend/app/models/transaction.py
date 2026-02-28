# ========================================
# STOCKTECH - Transaction Models (Marketplace)
# ========================================

import enum
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Boolean, Column, DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship

from .base import Base

class TransactionStatus(str, enum.Enum):
    """Transaction status in the marketplace"""
    PENDING = "pending"              # Initial interest shown
    NEGOTIATING = "negotiating"      # Active negotiation via WhatsApp
    AGREED = "agreed"                # Price and terms agreed
    PAYMENT_PENDING = "payment_pending"  # Waiting for payment
    PAID = "paid"                    # Payment confirmed
    SHIPPED = "shipped"              # Product shipped
    DELIVERED = "delivered"          # Product delivered
    COMPLETED = "completed"          # Transaction completed
    CANCELLED = "cancelled"          # Transaction cancelled
    DISPUTED = "disputed"            # Dispute opened

class TransactionType(str, enum.Enum):
    """Type of transaction"""
    SALE = "sale"                    # Direct sale
    NEGOTIATION = "negotiation"      # Price negotiation
    TRADE = "trade"                  # Product exchange
    QUOTE = "quote"                  # Quote request

class Transaction(Base):
    """
    Transaction model - Marketplace transactions
    Tracks all interactions between buyers and sellers
    """
    __tablename__ = "transactions"
    
    # References to AvAdmin (no FK - microservices)
    buyer_id = Column(UUID(as_uuid=True), nullable=False, index=True)    # Buyer user
    seller_id = Column(UUID(as_uuid=True), nullable=False, index=True)   # Seller user
    buyer_account_id = Column(UUID(as_uuid=True), nullable=False, index=True)   # Buyer company
    seller_account_id = Column(UUID(as_uuid=True), nullable=False, index=True)  # Seller company
    
    # Product reference
    product_id = Column(
        UUID(as_uuid=True),
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # Transaction Details
    type = Column(Enum(TransactionType), default=TransactionType.SALE, nullable=False)
    status = Column(Enum(TransactionStatus), default=TransactionStatus.PENDING, nullable=False)
    
    # Quantities and Pricing
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)         # Agreed unit price
    original_price = Column(Numeric(10, 2), nullable=False)     # Product's original price
    total_amount = Column(Numeric(10, 2), nullable=False)       # quantity * unit_price
    
    # Negotiation Details
    buyer_offer = Column(Numeric(10, 2), nullable=True)         # Buyer's offer
    seller_counter_offer = Column(Numeric(10, 2), nullable=True)  # Seller's counter
    negotiation_notes = Column(Text, nullable=True)             # Internal notes
    
    # WhatsApp Integration
    whatsapp_chat_id = Column(String(100), nullable=True, index=True)  # Chat tracking
    whatsapp_message_count = Column(Integer, default=0, nullable=False)
    last_whatsapp_activity = Column(DateTime(timezone=True), nullable=True)
    
    # Payment Information
    payment_method = Column(String(50), nullable=True)          # PIX, boleto, etc.
    payment_reference = Column(String(100), nullable=True)      # Payment gateway reference
    
    # Shipping Information
    requires_shipping = Column(Boolean, default=True, nullable=False)
    shipping_address = Column(Text, nullable=True)
    shipping_cost = Column(Numeric(10, 2), default=0, nullable=False)
    tracking_code = Column(String(50), nullable=True)
    
    # Timestamps
    agreed_at = Column(DateTime(timezone=True), nullable=True)    # When deal was agreed
    paid_at = Column(DateTime(timezone=True), nullable=True)      # When payment was made
    shipped_at = Column(DateTime(timezone=True), nullable=True)   # When product was shipped
    delivered_at = Column(DateTime(timezone=True), nullable=True) # When product was delivered
    completed_at = Column(DateTime(timezone=True), nullable=True) # Transaction completion
    cancelled_at = Column(DateTime(timezone=True), nullable=True) # Cancellation time
    
    # Cancellation/Dispute
    cancellation_reason = Column(String(200), nullable=True)
    cancelled_by = Column(String(10), nullable=True)            # 'buyer' or 'seller'
    dispute_reason = Column(Text, nullable=True)
    
    # Ratings and Reviews
    buyer_rating = Column(Integer, nullable=True)               # 1-5 rating from buyer
    seller_rating = Column(Integer, nullable=True)              # 1-5 rating from seller
    buyer_review = Column(Text, nullable=True)
    seller_review = Column(Text, nullable=True)
    
    # Internal tracking
    source = Column(String(50), default="marketplace", nullable=False)  # Where it originated
    conversion_funnel = Column(
        JSONB,
        default=list,
        nullable=False,
        comment="Track user journey: ['product_view', 'whatsapp_click', 'negotiation_started']"
    )
    
    # Additional data
    extra_data = Column(
        JSONB,
        default=dict,
        nullable=False,
        comment="Additional transaction metadata"
    )
    
    # Relationships (will be defined after all models are loaded)
    # product = relationship("Product", back_populates="transactions")
    
    def __repr__(self):
        return f"<Transaction {self.id}: {self.status.value}>"
    
    @property
    def total_formatted(self) -> str:
        """Return formatted total: R$ 8.500,00"""
        return f"R$ {self.total_amount:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    @property
    def unit_price_formatted(self) -> str:
        """Return formatted unit price: R$ 8.500,00"""
        return f"R$ {self.unit_price:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    
    @property
    def is_completed(self) -> bool:
        """Check if transaction is completed"""
        return self.status == TransactionStatus.COMPLETED
    
    @property
    def is_cancelled(self) -> bool:
        """Check if transaction is cancelled"""
        return self.status == TransactionStatus.CANCELLED
    
    @property
    def is_active(self) -> bool:
        """Check if transaction is active (not completed/cancelled)"""
        return self.status not in [TransactionStatus.COMPLETED, TransactionStatus.CANCELLED]
    
    @property
    def discount_amount(self) -> Decimal:
        """Calculate discount from original price"""
        return (self.original_price - self.unit_price) * self.quantity
    
    @property
    def discount_percentage(self) -> float:
        """Calculate discount percentage"""
        if self.original_price == 0:
            return 0.0
        return float(((self.original_price - self.unit_price) / self.original_price) * 100)
    
    @property
    def duration_days(self) -> Optional[int]:
        """Get transaction duration in days"""
        if not self.completed_at:
            return None
        return (self.completed_at - self.created_at).days
    
    def calculate_total(self):
        """Calculate and update total amount"""
        self.total_amount = self.unit_price * self.quantity
    
    def add_conversion_step(self, step: str):
        """Add step to conversion funnel"""
        if not self.conversion_funnel:
            self.conversion_funnel = []
        
        if step not in self.conversion_funnel:
            self.conversion_funnel.append(step)
    
    def update_status(self, new_status: TransactionStatus, timestamp: Optional[datetime] = None):
        """Update transaction status with timestamp"""
        self.status = new_status
        now = timestamp or datetime.utcnow()
        
        # Update specific timestamp fields
        if new_status == TransactionStatus.AGREED:
            self.agreed_at = now
        elif new_status == TransactionStatus.PAID:
            self.paid_at = now
        elif new_status == TransactionStatus.SHIPPED:
            self.shipped_at = now
        elif new_status == TransactionStatus.DELIVERED:
            self.delivered_at = now
        elif new_status == TransactionStatus.COMPLETED:
            self.completed_at = now
        elif new_status == TransactionStatus.CANCELLED:
            self.cancelled_at = now
    
    def cancel(self, reason: str, cancelled_by: str):
        """Cancel transaction"""
        self.status = TransactionStatus.CANCELLED
        self.cancelled_at = datetime.utcnow()
        self.cancellation_reason = reason
        self.cancelled_by = cancelled_by
    
    def add_rating(self, rating: int, review: Optional[str] = None, by: str = "buyer"):
        """Add rating and review"""
        if by == "buyer":
            self.buyer_rating = rating
            if review:
                self.buyer_review = review
        elif by == "seller":
            self.seller_rating = rating
            if review:
                self.seller_review = review
    
    def get_whatsapp_summary(self) -> str:
        """Generate WhatsApp summary message"""
        message = f"📋 *Resumo da Negociação*\n\n"
        message += f"🔥 Produto: {self.product.name}\n"
        message += f"📦 Código: {self.product.code}\n"
        message += f"💰 Preço Acordado: {self.unit_price_formatted}\n"
        message += f"📊 Quantidade: {self.quantity}\n"
        message += f"💵 Total: {self.total_formatted}\n\n"
        
        if self.status == TransactionStatus.AGREED:
            message += "✅ *Negociação Finalizada!*\n"
            message += "Aguardando confirmação de pagamento."
        elif self.status == TransactionStatus.PAID:
            message += "✅ *Pagamento Confirmado!*\n"
            message += "Produto será enviado em breve."
        
        return message
    
    def to_summary_dict(self) -> dict:
        """Convert to summary dictionary for APIs"""
        return {
            "id": str(self.id),
            "type": self.type.value,
            "status": self.status.value,
            "quantity": self.quantity,
            "unit_price": float(self.unit_price),
            "unit_price_formatted": self.unit_price_formatted,
            "total_amount": float(self.total_amount),
            "total_formatted": self.total_formatted,
            "discount_percentage": self.discount_percentage,
            "product": {
                "id": str(self.product.id),
                "name": self.product.name,
                "code": self.product.code,
                "image": self.product.primary_image_url
            },
            "created_at": self.created_at.isoformat(),
            "agreed_at": self.agreed_at.isoformat() if self.agreed_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }