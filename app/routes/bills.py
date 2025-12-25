"""
GrePre Smart Life - Bill Routes
With strict ownership enforcement, soft deletes, tier limits, and transaction safety
"""

from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.exceptions import (
    AccessDeniedError,
    ErrorCode,
    NotFoundError,
    TransactionError,
    ValidationError,
    create_success_response,
)
from app.models import Bill, BillCategory, BillFrequency, BillStatus, Payment, User
from app.routes.auth import get_current_user
from app.schemas import (
    BillCreate,
    BillResponse,
    BillUpdate,
    BillWithPayments,
    PaymentCreate,
    PaymentResponse,
)
from app.services.tier import TierLimitExceededError, enforce_bill_limit

router = APIRouter(prefix="/bills", tags=["Bills"])


def calculate_bill_status(due_date: date) -> BillStatus:
    """Calculate bill status based on due date"""
    today = date.today()
    days_until_due = (due_date - today).days

    if days_until_due < 0:
        return BillStatus.OVERDUE
    elif days_until_due <= 3:
        return BillStatus.DUE_SOON
    else:
        return BillStatus.PENDING


async def get_user_bill(
    bill_id: int, user_id: int, db: AsyncSession, include_deleted: bool = False
) -> Bill:
    """
    Get a bill with strict ownership check.
    Raises appropriate errors if not found or access denied.
    """
    query = select(Bill).where(Bill.id == bill_id)

    if not include_deleted:
        query = query.where(Bill.is_deleted == False)

    result = await db.execute(query)
    bill = result.scalar_one_or_none()

    if not bill:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.BILL_NOT_FOUND, "message": "Bill not found"},
        )

    # Strict ownership check
    if bill.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": ErrorCode.BILL_ACCESS_DENIED,
                "message": "You do not have access to this bill",
            },
        )

    return bill


@router.get("", response_model=List[BillResponse])
async def get_bills(
    status_filter: Optional[BillStatus] = Query(None, alias="status"),
    category: Optional[BillCategory] = None,
    search: Optional[str] = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all bills for the current user with ownership enforcement"""
    # Base query with ownership filter - always filter by user_id
    if include_deleted:
        query = select(Bill).where(Bill.user_id == current_user.id)
    else:
        query = select(Bill).where(
            and_(Bill.user_id == current_user.id, Bill.is_deleted == False)
        )

    if status_filter:
        query = query.where(Bill.status == status_filter)
    if category:
        query = query.where(Bill.category == category)
    if search:
        query = query.where(Bill.name.ilike(f"%{search}%"))

    query = query.order_by(Bill.due_date)
    result = await db.execute(query)
    bills = result.scalars().all()

    # Update status based on due date
    for bill in bills:
        if bill.status != BillStatus.PAID:
            new_status = calculate_bill_status(bill.due_date)
            if bill.status != new_status:
                bill.status = new_status

    await db.commit()
    return bills


@router.get("/{bill_id}", response_model=BillWithPayments)
async def get_bill(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single bill with ownership enforcement"""
    # First check ownership
    await get_user_bill(bill_id, current_user.id, db)

    # Then get with relationships
    result = await db.execute(
        select(Bill)
        .options(selectinload(Bill.payments))
        .where(and_(Bill.id == bill_id, Bill.user_id == current_user.id))
    )
    bill = result.scalar_one_or_none()
    return bill


@router.post("", response_model=BillResponse, status_code=status.HTTP_201_CREATED)
async def create_bill(
    bill_data: BillCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new bill with transaction safety and tier limit enforcement"""
    try:
        # Check tier limits before creating
        await enforce_bill_limit(db, current_user)

        bill = Bill(
            **bill_data.model_dump(),
            user_id=current_user.id,
            status=calculate_bill_status(bill_data.due_date),
            is_deleted=False,
        )
        db.add(bill)
        await db.commit()
        await db.refresh(bill)
        return bill
    except TierLimitExceededError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": ErrorCode.TIER_BILL_LIMIT_REACHED,
                "message": e.message,
                "limit": e.limit,
                "current": e.current,
            },
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.TRANSACTION_FAILED,
                "message": f"Failed to create bill: {str(e)}",
            },
        )


@router.put("/{bill_id}", response_model=BillResponse)
async def update_bill(
    bill_id: int,
    bill_data: BillUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a bill with ownership enforcement and transaction safety"""
    bill = await get_user_bill(bill_id, current_user.id, db)

    try:
        update_data = bill_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(bill, field, value)

        # Recalculate status if due_date changed and not manually set to PAID
        if bill.status != BillStatus.PAID:
            bill.status = calculate_bill_status(bill.due_date)

        await db.commit()
        await db.refresh(bill)
        return bill
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.TRANSACTION_FAILED,
                "message": f"Failed to update bill: {str(e)}",
            },
        )


@router.delete("/{bill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bill(
    bill_id: int,
    permanent: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a bill (soft delete by default).
    Use permanent=True for permanent deletion.
    """
    bill = await get_user_bill(bill_id, current_user.id, db, include_deleted=True)

    try:
        if permanent:
            await db.delete(bill)
        else:
            bill.soft_delete()

        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.TRANSACTION_FAILED,
                "message": f"Failed to delete bill: {str(e)}",
            },
        )


@router.post("/{bill_id}/restore", response_model=BillResponse)
async def restore_bill(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Restore a soft-deleted bill"""
    bill = await get_user_bill(bill_id, current_user.id, db, include_deleted=True)

    if not bill.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.BILL_NOT_FOUND, "message": "Bill is not deleted"},
        )

    try:
        bill.is_deleted = False
        bill.deleted_at = None
        bill.status = calculate_bill_status(bill.due_date)

        await db.commit()
        await db.refresh(bill)
        return bill
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.TRANSACTION_FAILED,
                "message": f"Failed to restore bill: {str(e)}",
            },
        )


@router.post("/{bill_id}/pay", response_model=PaymentResponse)
async def pay_bill(
    bill_id: int,
    payment_data: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Record a payment for a bill with transaction safety.
    Updates bill status atomically with payment creation.
    """
    bill = await get_user_bill(bill_id, current_user.id, db)

    try:
        # Create payment
        payment = Payment(
            bill_id=bill_id,
            amount=payment_data.amount,
            paid_date=payment_data.paid_date,
            confirmation_number=payment_data.confirmation_number,
            notes=payment_data.notes,
        )
        db.add(payment)

        # Update bill status atomically
        bill.status = BillStatus.PAID

        # Handle recurring bill - create next occurrence
        if bill.frequency != BillFrequency.ONCE:
            await create_next_recurring_bill(bill, db)

        await db.commit()
        await db.refresh(payment)
        return payment
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={
                "code": ErrorCode.TRANSACTION_FAILED,
                "message": f"Failed to record payment: {str(e)}",
            },
        )


async def create_next_recurring_bill(bill: Bill, db: AsyncSession) -> Optional[Bill]:
    """Create the next occurrence of a recurring bill"""
    frequency_days = {
        BillFrequency.WEEKLY: 7,
        BillFrequency.BI_WEEKLY: 14,
        BillFrequency.MONTHLY: 30,
        BillFrequency.QUARTERLY: 90,
        BillFrequency.BI_ANNUALLY: 180,
        BillFrequency.ANNUALLY: 365,
    }

    if bill.frequency == BillFrequency.ONCE:
        return None

    days_to_add = frequency_days.get(bill.frequency, 30)
    next_due_date = bill.due_date + timedelta(days=days_to_add)

    next_bill = Bill(
        user_id=bill.user_id,
        name=bill.name,
        amount=bill.amount,
        category=bill.category,
        due_date=next_due_date,
        frequency=bill.frequency,
        status=calculate_bill_status(next_due_date),
        is_auto_pay=bill.is_auto_pay,
        notes=bill.notes,
        reminder_days=bill.reminder_days,
        is_deleted=False,
    )
    db.add(next_bill)
    return next_bill


@router.get("/{bill_id}/payments", response_model=List[PaymentResponse])
async def get_bill_payments(
    bill_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all payments for a bill with ownership enforcement"""
    await get_user_bill(bill_id, current_user.id, db)

    result = await db.execute(
        select(Payment)
        .where(Payment.bill_id == bill_id)
        .order_by(Payment.paid_date.desc())
    )
    return result.scalars().all()
