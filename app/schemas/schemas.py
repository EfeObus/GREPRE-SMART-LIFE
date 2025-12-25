"""
GrePre Smart Life - Pydantic Schemas
"""
from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field
from app.models.models import BillCategory, BillFrequency, BillStatus, DocumentCategory, SubscriptionTier


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    full_name: str


class UserCreate(UserBase):
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    currency: Optional[str] = None
    theme: Optional[str] = None
    notifications_enabled: Optional[bool] = None


class UserResponse(UserBase):
    id: int
    is_active: bool
    currency: str
    theme: str
    notifications_enabled: bool
    subscription_tier: SubscriptionTier
    subscription_expires_at: Optional[datetime] = None
    organization_id: Optional[int] = None
    is_org_admin: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    """Token response with access and refresh tokens."""
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None  # Seconds until access token expires


class RefreshTokenRequest(BaseModel):
    """Request body for token refresh."""
    refresh_token: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


# Bill Schemas
class BillBase(BaseModel):
    name: str
    amount: float = Field(..., gt=0)
    category: BillCategory = BillCategory.OTHER
    due_date: date
    frequency: BillFrequency = BillFrequency.MONTHLY
    is_auto_pay: bool = False
    notes: Optional[str] = None
    reminder_days: int = 7


class BillCreate(BillBase):
    pass


class BillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[BillCategory] = None
    due_date: Optional[date] = None
    frequency: Optional[BillFrequency] = None
    status: Optional[BillStatus] = None
    is_auto_pay: Optional[bool] = None
    notes: Optional[str] = None
    reminder_days: Optional[int] = None


class BillResponse(BillBase):
    id: int
    user_id: int
    status: BillStatus
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class BillWithPayments(BillResponse):
    payments: List["PaymentResponse"] = []
    linked_documents: List["DocumentResponse"] = []


# Payment Schemas
class PaymentBase(BaseModel):
    amount: float = Field(..., gt=0)
    paid_date: date
    confirmation_number: Optional[str] = None
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    bill_id: int


class PaymentResponse(PaymentBase):
    id: int
    bill_id: int
    created_at: datetime

    class Config:
        from_attributes = True


# Document Schemas
class DocumentBase(BaseModel):
    name: str
    category: DocumentCategory = DocumentCategory.OTHER
    expiry_date: Optional[date] = None
    is_protected: bool = False
    notes: Optional[str] = None
    tags: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[DocumentCategory] = None
    expiry_date: Optional[date] = None
    is_protected: Optional[bool] = None
    notes: Optional[str] = None
    tags: Optional[str] = None


class DocumentResponse(DocumentBase):
    id: int
    user_id: int
    file_type: Optional[str] = None
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    uploaded_at: Optional[datetime] = None
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Dashboard Schemas
class DashboardStats(BaseModel):
    total_bills: int
    total_documents: int
    pending_bills: int
    overdue_bills: int
    due_soon_bills: int
    monthly_total: float
    expiring_documents: int
    # Tier usage information
    subscription_tier: SubscriptionTier
    bills_limit: Optional[int] = None  # None means unlimited
    documents_limit: Optional[int] = None  # None means unlimited
    bills_remaining: Optional[int] = None  # None means unlimited
    documents_remaining: Optional[int] = None  # None means unlimited


class UpcomingBill(BaseModel):
    id: int
    name: str
    amount: float
    due_date: date
    days_until_due: int
    category: BillCategory
    status: BillStatus


class ExpiringDocument(BaseModel):
    id: int
    name: str
    expiry_date: date
    days_until_expiry: int
    category: DocumentCategory


# OCR Schemas
class OCRResult(BaseModel):
    amount: Optional[float] = None
    due_date: Optional[str] = None
    biller_name: Optional[str] = None
    account_number: Optional[str] = None
    suggested_category: Optional[BillCategory] = None
    confidence: float = 0.0
    raw_text: str = ""


# Update forward references
BillWithPayments.model_rebuild()


# Subscription Tier Schemas
class TierInfo(BaseModel):
    """Information about a subscription tier"""
    tier: SubscriptionTier
    max_bills: Optional[int] = None
    max_documents: Optional[int] = None
    price_monthly: Optional[float] = None
    price_per_user: Optional[float] = None
    features: List[str] = []


class TierUsage(BaseModel):
    """Current usage against tier limits"""
    subscription_tier: SubscriptionTier
    bills_used: int
    bills_limit: Optional[int] = None
    bills_remaining: Optional[int] = None
    documents_used: int
    documents_limit: Optional[int] = None
    documents_remaining: Optional[int] = None
    can_create_bill: bool
    can_create_document: bool
    upgrade_required: bool = False


class TierUpgradeRequest(BaseModel):
    """Request to upgrade subscription tier"""
    target_tier: SubscriptionTier


class OrganizationCreate(BaseModel):
    """Create a new organization"""
    name: str = Field(..., min_length=2, max_length=255)
    max_users: int = Field(default=10, ge=1, le=1000)


class OrganizationResponse(BaseModel):
    """Organization response"""
    id: int
    name: str
    slug: str
    owner_id: int
    max_users: int
    price_per_user: float
    member_count: int = 0
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OrganizationInvite(BaseModel):
    """Invite a user to organization"""
    email: EmailStr
