"""
GrePre Smart Life - Database Models
"""

import enum
import hashlib
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, Column, Date, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy import Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class SubscriptionTier(str, enum.Enum):
    """User subscription tiers"""

    FREE = "free"  # 3 bills, 3 documents
    INDIVIDUAL = "individual"  # Unlimited - $6 CAD/month
    ORGANIZATION = "organization"  # Unlimited - $3 CAD/user/month


class BillCategory(str, enum.Enum):
    RENT = "rent"
    UTILITIES = "utilities"
    SUBSCRIPTIONS = "subscriptions"
    INSURANCE = "insurance"
    SCHOOL_FEES = "school_fees"
    LOANS = "loans"
    CREDIT_CARD = "credit_card"
    OTHER = "other"


class BillFrequency(str, enum.Enum):
    ONCE = "once"
    WEEKLY = "weekly"
    BI_WEEKLY = "bi_weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    BI_ANNUALLY = "bi_annually"
    ANNUALLY = "annually"


class BillStatus(str, enum.Enum):
    PENDING = "pending"
    DUE_SOON = "due_soon"
    OVERDUE = "overdue"
    PAID = "paid"


class DocumentCategory(str, enum.Enum):
    ID = "id"
    VISA = "visa"
    PASSPORT = "passport"
    PERMIT = "permit"
    LICENSE = "license"
    WARRANTY = "warranty"
    INSURANCE = "insurance"
    CERTIFICATE = "certificate"
    CONTRACT = "contract"
    RECEIPT = "receipt"
    OTHER = "other"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Settings
    currency = Column(String(10), default="USD")
    theme = Column(String(20), default="light")
    notifications_enabled = Column(Boolean, default=True)

    # Default reminder settings
    default_reminder_days = Column(Integer, default=7)
    default_bill_category = Column(SQLEnum(BillCategory), default=BillCategory.OTHER)

    # Bootstrap flag
    is_bootstrapped = Column(Boolean, default=False)

    # Subscription tier
    subscription_tier = Column(
        SQLEnum(SubscriptionTier, values_callable=lambda x: [e.value for e in x]),
        default=SubscriptionTier.FREE,
    )
    subscription_started_at = Column(DateTime, nullable=True)
    subscription_expires_at = Column(DateTime, nullable=True)

    # Organization fields
    organization_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)
    is_org_admin = Column(Boolean, default=False)

    bills = relationship("Bill", back_populates="user", cascade="all, delete-orphan")
    documents = relationship(
        "Document", back_populates="user", cascade="all, delete-orphan"
    )
    organization = relationship("Organization", back_populates="members")


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    category = Column(SQLEnum(BillCategory), default=BillCategory.OTHER)
    due_date = Column(Date, nullable=False)
    frequency = Column(SQLEnum(BillFrequency), default=BillFrequency.MONTHLY)
    status = Column(SQLEnum(BillStatus), default=BillStatus.PENDING)
    is_auto_pay = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    reminder_days = Column(Integer, default=7)

    # Audit timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="bills")
    payments = relationship(
        "Payment", back_populates="bill", cascade="all, delete-orphan"
    )
    linked_documents = relationship(
        "BillDocumentLink", back_populates="bill", cascade="all, delete-orphan"
    )

    def soft_delete(self):
        """Mark bill as deleted without removing from database"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    amount = Column(Float, nullable=False)
    paid_date = Column(Date, nullable=False)
    confirmation_number = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="payments")


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    category = Column(SQLEnum(DocumentCategory), default=DocumentCategory.OTHER)
    expiry_date = Column(Date, nullable=True)
    is_protected = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    tags = Column(String(500), nullable=True)  # Comma-separated tags

    # File metadata
    file_path = Column(
        String(500), nullable=True
    )  # Internal storage path (not exposed in exports)
    file_type = Column(String(100), nullable=True)  # MIME type
    original_filename = Column(String(255), nullable=True)  # Original uploaded filename
    file_size = Column(BigInteger, nullable=True)  # File size in bytes
    file_checksum = Column(String(64), nullable=True)  # SHA-256 checksum
    uploaded_at = Column(DateTime, nullable=True)  # Upload timestamp

    # Audit timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Soft delete
    is_deleted = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="documents")
    linked_bills = relationship(
        "BillDocumentLink", back_populates="document", cascade="all, delete-orphan"
    )

    def soft_delete(self):
        """Mark document as deleted without removing from database"""
        self.is_deleted = True
        self.deleted_at = datetime.utcnow()

    @staticmethod
    def calculate_checksum(file_content: bytes) -> str:
        """Calculate SHA-256 checksum of file content"""
        return hashlib.sha256(file_content).hexdigest()


class BillDocumentLink(Base):
    __tablename__ = "bill_document_links"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="linked_documents")
    document = relationship("Document", back_populates="linked_bills")


class Organization(Base):
    """Organization for team subscriptions"""

    __tablename__ = "organizations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, index=True, nullable=False)
    owner_id = Column(Integer, nullable=False)  # User ID of the owner

    # Subscription
    max_users = Column(Integer, default=10)
    price_per_user = Column(Float, default=3.0)  # $3 CAD per user

    # Audit timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)

    members = relationship("User", back_populates="organization")


# Tier limits configuration
TIER_LIMITS = {
    SubscriptionTier.FREE: {
        "max_bills": 3,
        "max_documents": 3,
        "price_monthly": 0.0,
        "features": ["basic_features", "email_reminders"],
    },
    SubscriptionTier.INDIVIDUAL: {
        "max_bills": None,  # Unlimited
        "max_documents": None,  # Unlimited
        "price_monthly": 6.0,  # $6 CAD/month
        "features": ["all_features", "priority_support", "email_reminders"],
    },
    SubscriptionTier.ORGANIZATION: {
        "max_bills": None,  # Unlimited
        "max_documents": None,  # Unlimited
        "price_per_user": 3.0,  # $3 CAD/user/month
        "features": [
            "all_features",
            "team_management",
            "admin_dashboard",
            "bulk_operations",
            "priority_support",
        ],
    },
}
