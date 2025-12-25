"""
GrePre Smart Life - Dashboard Routes
With soft delete filtering, tier usage, and data export
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import TIER_LIMITS, Bill, BillStatus, Document, User
from app.routes.auth import get_current_user
from app.schemas import DashboardStats, ExpiringDocument, TierUsage, UpcomingBill
from app.services.export import export_to_csv_format, export_user_data
from app.services.tier import get_all_tier_info, get_tier_limits, get_tier_usage

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    today = date.today()
    month_start = today.replace(day=1)
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1) - timedelta(
            days=1
        )
    else:
        month_end = today.replace(month=today.month + 1, day=1) - timedelta(days=1)

    # Total bills (excluding deleted)
    result = await db.execute(
        select(func.count(Bill.id)).where(
            and_(Bill.user_id == current_user.id, Bill.is_deleted == False)
        )
    )
    total_bills = result.scalar() or 0

    # Total documents (excluding deleted)
    result = await db.execute(
        select(func.count(Document.id)).where(
            and_(Document.user_id == current_user.id, Document.is_deleted == False)
        )
    )
    total_documents = result.scalar() or 0

    # Pending bills
    result = await db.execute(
        select(func.count(Bill.id)).where(
            and_(
                Bill.user_id == current_user.id,
                Bill.status == BillStatus.PENDING,
                Bill.is_deleted == False,
            )
        )
    )
    pending_bills = result.scalar() or 0

    # Overdue bills
    result = await db.execute(
        select(func.count(Bill.id)).where(
            and_(
                Bill.user_id == current_user.id,
                Bill.status == BillStatus.OVERDUE,
                Bill.is_deleted == False,
            )
        )
    )
    overdue_bills = result.scalar() or 0

    # Due soon bills
    result = await db.execute(
        select(func.count(Bill.id)).where(
            and_(
                Bill.user_id == current_user.id,
                Bill.status == BillStatus.DUE_SOON,
                Bill.is_deleted == False,
            )
        )
    )
    due_soon_bills = result.scalar() or 0

    # Monthly total (excluding deleted)
    result = await db.execute(
        select(func.sum(Bill.amount)).where(
            and_(
                Bill.user_id == current_user.id,
                Bill.due_date >= month_start,
                Bill.due_date <= month_end,
                Bill.is_deleted == False,
            )
        )
    )
    monthly_total = result.scalar() or 0.0

    # Expiring documents (within 30 days, excluding deleted)
    expiry_threshold = today + timedelta(days=30)
    result = await db.execute(
        select(func.count(Document.id)).where(
            and_(
                Document.user_id == current_user.id,
                Document.expiry_date.isnot(None),
                Document.expiry_date <= expiry_threshold,
                Document.expiry_date >= today,
                Document.is_deleted == False,
            )
        )
    )
    expiring_documents = result.scalar() or 0

    # Get tier limits for the user
    tier_limits = get_tier_limits(current_user.subscription_tier)
    max_bills = tier_limits.get("max_bills")
    max_documents = tier_limits.get("max_documents")

    bills_remaining = None if max_bills is None else max(0, max_bills - total_bills)
    documents_remaining = (
        None if max_documents is None else max(0, max_documents - total_documents)
    )

    return DashboardStats(
        total_bills=total_bills,
        total_documents=total_documents,
        pending_bills=pending_bills,
        overdue_bills=overdue_bills,
        due_soon_bills=due_soon_bills,
        monthly_total=monthly_total,
        expiring_documents=expiring_documents,
        subscription_tier=current_user.subscription_tier,
        bills_limit=max_bills,
        documents_limit=max_documents,
        bills_remaining=bills_remaining,
        documents_remaining=documents_remaining,
    )


@router.get("/upcoming-bills", response_model=list[UpcomingBill])
async def get_upcoming_bills(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    result = await db.execute(
        select(Bill)
        .where(
            and_(
                Bill.user_id == current_user.id,
                Bill.status != BillStatus.PAID,
                Bill.due_date >= today,
                Bill.is_deleted == False,
            )
        )
        .order_by(Bill.due_date)
        .limit(limit)
    )
    bills = result.scalars().all()

    return [
        UpcomingBill(
            id=bill.id,
            name=bill.name,
            amount=bill.amount,
            due_date=bill.due_date,
            days_until_due=(bill.due_date - today).days,
            category=bill.category,
            status=bill.status,
        )
        for bill in bills
    ]


@router.get("/overdue-bills", response_model=list[UpcomingBill])
async def get_overdue_bills(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()

    result = await db.execute(
        select(Bill)
        .where(
            and_(
                Bill.user_id == current_user.id,
                Bill.status == BillStatus.OVERDUE,
                Bill.is_deleted == False,
            )
        )
        .order_by(Bill.due_date)
        .limit(limit)
    )
    bills = result.scalars().all()

    return [
        UpcomingBill(
            id=bill.id,
            name=bill.name,
            amount=bill.amount,
            due_date=bill.due_date,
            days_until_due=(bill.due_date - today).days,
            category=bill.category,
            status=bill.status,
        )
        for bill in bills
    ]


@router.get("/expiring-documents", response_model=list[ExpiringDocument])
async def get_expiring_documents(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    expiry_threshold = today + timedelta(days=30)

    result = await db.execute(
        select(Document)
        .where(
            and_(
                Document.user_id == current_user.id,
                Document.expiry_date.isnot(None),
                Document.expiry_date <= expiry_threshold,
                Document.expiry_date >= today,
                Document.is_deleted == False,
            )
        )
        .order_by(Document.expiry_date)
        .limit(limit)
    )
    documents = result.scalars().all()

    return [
        ExpiringDocument(
            id=doc.id,
            name=doc.name,
            expiry_date=doc.expiry_date,
            days_until_expiry=(doc.expiry_date - today).days,
            category=doc.category,
        )
        for doc in documents
    ]


@router.get("/export")
async def export_data(
    format: str = Query("json", description="Export format: json or csv"),
    include_deleted: bool = Query(False, description="Include soft-deleted records"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Export all user data.
    Excludes sensitive information (password hash, internal file paths).
    Includes all relationships (bills, documents, payments, document links).
    """
    if format == "csv":
        data = await export_to_csv_format(current_user.id, db, include_deleted)
    else:
        data = await export_user_data(current_user.id, db, include_deleted)

    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": f'attachment; filename="grepre_export_{date.today().isoformat()}.json"'
        },
    )


@router.get("/tier-usage", response_model=TierUsage)
async def get_user_tier_usage(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """
    Get the current user's subscription tier usage.
    Shows limits, current usage, and whether they can create more items.
    """
    usage = await get_tier_usage(db, current_user)
    return TierUsage(**usage)


@router.get("/tiers")
async def get_available_tiers():
    """
    Get information about all available subscription tiers.
    This endpoint is public and shows pricing and features.
    """
    return {"tiers": get_all_tier_info(), "currency": "CAD", "billing_cycle": "monthly"}
