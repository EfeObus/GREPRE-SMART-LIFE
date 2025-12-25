"""
GrePre Smart Life - Subscription Tier Service
Handles tier limit checking and subscription management
"""
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models import User, Bill, Document, SubscriptionTier, TIER_LIMITS


class TierLimitExceededError(Exception):
    """Raised when a user exceeds their tier limits"""
    def __init__(self, message: str, resource_type: str, limit: int, current: int):
        self.message = message
        self.resource_type = resource_type
        self.limit = limit
        self.current = current
        super().__init__(self.message)


async def get_user_bill_count(db: AsyncSession, user_id: int) -> int:
    """Get the count of active (non-deleted) bills for a user"""
    result = await db.execute(
        select(func.count(Bill.id)).where(
            and_(
                Bill.user_id == user_id,
                Bill.is_deleted == False
            )
        )
    )
    return result.scalar() or 0


async def get_user_document_count(db: AsyncSession, user_id: int) -> int:
    """Get the count of active (non-deleted) documents for a user"""
    result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.user_id == user_id,
                Document.is_deleted == False
            )
        )
    )
    return result.scalar() or 0


def get_tier_limits(tier: SubscriptionTier) -> Dict[str, Any]:
    """Get the limits for a subscription tier"""
    return TIER_LIMITS.get(tier, TIER_LIMITS[SubscriptionTier.FREE])


def is_subscription_active(user: User) -> bool:
    """Check if user's subscription is currently active"""
    # Free tier is always active
    if user.subscription_tier == SubscriptionTier.FREE:
        return True
    
    # Check expiration for paid tiers
    if user.subscription_expires_at is None:
        return True  # No expiration set means active
    
    return user.subscription_expires_at > datetime.utcnow()


async def check_bill_limit(db: AsyncSession, user: User) -> Dict[str, Any]:
    """
    Check if user can create a new bill based on their tier.
    Returns dict with limit info and whether creation is allowed.
    """
    tier_limits = get_tier_limits(user.subscription_tier)
    max_bills = tier_limits.get("max_bills")
    
    # Unlimited (paid tiers)
    if max_bills is None:
        return {
            "can_create": True,
            "limit": None,
            "current": await get_user_bill_count(db, user.id),
            "remaining": None
        }
    
    current_count = await get_user_bill_count(db, user.id)
    remaining = max_bills - current_count
    
    return {
        "can_create": current_count < max_bills,
        "limit": max_bills,
        "current": current_count,
        "remaining": max(0, remaining)
    }


async def check_document_limit(db: AsyncSession, user: User) -> Dict[str, Any]:
    """
    Check if user can create a new document based on their tier.
    Returns dict with limit info and whether creation is allowed.
    """
    tier_limits = get_tier_limits(user.subscription_tier)
    max_documents = tier_limits.get("max_documents")
    
    # Unlimited (paid tiers)
    if max_documents is None:
        return {
            "can_create": True,
            "limit": None,
            "current": await get_user_document_count(db, user.id),
            "remaining": None
        }
    
    current_count = await get_user_document_count(db, user.id)
    remaining = max_documents - current_count
    
    return {
        "can_create": current_count < max_documents,
        "limit": max_documents,
        "current": current_count,
        "remaining": max(0, remaining)
    }


async def get_tier_usage(db: AsyncSession, user: User) -> Dict[str, Any]:
    """Get complete tier usage information for a user"""
    tier_limits = get_tier_limits(user.subscription_tier)
    
    bill_count = await get_user_bill_count(db, user.id)
    document_count = await get_user_document_count(db, user.id)
    
    max_bills = tier_limits.get("max_bills")
    max_documents = tier_limits.get("max_documents")
    
    bills_remaining = None if max_bills is None else max(0, max_bills - bill_count)
    documents_remaining = None if max_documents is None else max(0, max_documents - document_count)
    
    can_create_bill = max_bills is None or bill_count < max_bills
    can_create_document = max_documents is None or document_count < max_documents
    
    return {
        "subscription_tier": user.subscription_tier,
        "bills_used": bill_count,
        "bills_limit": max_bills,
        "bills_remaining": bills_remaining,
        "documents_used": document_count,
        "documents_limit": max_documents,
        "documents_remaining": documents_remaining,
        "can_create_bill": can_create_bill,
        "can_create_document": can_create_document,
        "upgrade_required": not can_create_bill or not can_create_document,
        "is_subscription_active": is_subscription_active(user),
        "subscription_expires_at": user.subscription_expires_at
    }


async def enforce_bill_limit(db: AsyncSession, user: User) -> None:
    """
    Enforce bill creation limit. Raises TierLimitExceededError if limit reached.
    """
    limit_info = await check_bill_limit(db, user)
    
    if not limit_info["can_create"]:
        raise TierLimitExceededError(
            message=f"You have reached your bill limit of {limit_info['limit']}. "
                    f"Upgrade to Individual ($6 CAD/month) or Organization plan for unlimited bills.",
            resource_type="bill",
            limit=limit_info["limit"],
            current=limit_info["current"]
        )


async def enforce_document_limit(db: AsyncSession, user: User) -> None:
    """
    Enforce document creation limit. Raises TierLimitExceededError if limit reached.
    """
    limit_info = await check_document_limit(db, user)
    
    if not limit_info["can_create"]:
        raise TierLimitExceededError(
            message=f"You have reached your document limit of {limit_info['limit']}. "
                    f"Upgrade to Individual ($6 CAD/month) or Organization plan for unlimited documents.",
            resource_type="document",
            limit=limit_info["limit"],
            current=limit_info["current"]
        )


def get_all_tier_info() -> list:
    """Get information about all available tiers"""
    tiers = []
    for tier, limits in TIER_LIMITS.items():
        tier_info = {
            "tier": tier.value,
            "name": tier.value.title(),
            "max_bills": limits.get("max_bills"),
            "max_documents": limits.get("max_documents"),
            "price_monthly": limits.get("price_monthly"),
            "price_per_user": limits.get("price_per_user"),
            "features": limits.get("features", [])
        }
        tiers.append(tier_info)
    return tiers
