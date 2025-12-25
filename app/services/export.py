"""
GrePre Smart Life - Data Export Service
Complete and portable data export functionality
"""
from datetime import datetime, date
from typing import Dict, List, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models import User, Bill, Document, Payment, BillDocumentLink


def serialize_date(obj):
    """Serialize date/datetime objects to ISO format strings"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    elif isinstance(obj, date):
        return obj.isoformat()
    return obj


def serialize_enum(obj):
    """Serialize enum objects to their string values"""
    if hasattr(obj, 'value'):
        return obj.value
    return obj


async def export_user_data(
    user: User,
    db: AsyncSession,
    include_metadata: bool = True,
    include_relationships: bool = True,
    include_deleted: bool = False
) -> Dict[str, Any]:
    """
    Export all user data in a complete, portable format.
    
    Args:
        user: The user whose data to export
        db: Database session
        include_metadata: Include timestamps and status fields
        include_relationships: Include linked bills/documents
        include_deleted: Include soft-deleted records
        
    Returns:
        Complete data export dictionary
    """
    export_data = {
        "export_info": {
            "version": "1.0.0",
            "exported_at": datetime.utcnow().isoformat(),
            "app_name": "GrePre Smart Life",
            "format": "json"
        },
        "user": export_user_profile(user),
        "bills": [],
        "documents": [],
        "payments": [],
        "links": []
    }
    
    # Export bills
    bills_query = select(Bill).options(
        selectinload(Bill.payments),
        selectinload(Bill.linked_documents)
    ).where(Bill.user_id == user.id)
    
    if not include_deleted:
        bills_query = bills_query.where(Bill.is_deleted == False)
    
    result = await db.execute(bills_query)
    bills = result.scalars().all()
    
    for bill in bills:
        bill_data = export_bill(bill, include_metadata)
        
        if include_relationships:
            bill_data["payment_ids"] = [p.id for p in bill.payments]
            bill_data["linked_document_ids"] = [
                link.document_id for link in bill.linked_documents
            ]
        
        export_data["bills"].append(bill_data)
        
        # Export payments
        for payment in bill.payments:
            export_data["payments"].append(export_payment(payment, include_metadata))
    
    # Export documents
    docs_query = select(Document).options(
        selectinload(Document.linked_bills)
    ).where(Document.user_id == user.id)
    
    if not include_deleted:
        docs_query = docs_query.where(Document.is_deleted == False)
    
    result = await db.execute(docs_query)
    documents = result.scalars().all()
    
    for doc in documents:
        doc_data = export_document(doc, include_metadata)
        
        if include_relationships:
            doc_data["linked_bill_ids"] = [
                link.bill_id for link in doc.linked_bills
            ]
        
        export_data["documents"].append(doc_data)
    
    # Export bill-document links
    if include_relationships:
        links_query = select(BillDocumentLink).join(Bill).where(Bill.user_id == user.id)
        result = await db.execute(links_query)
        links = result.scalars().all()
        
        for link in links:
            export_data["links"].append({
                "id": link.id,
                "bill_id": link.bill_id,
                "document_id": link.document_id,
                "created_at": serialize_date(link.created_at)
            })
    
    # Add summary
    export_data["summary"] = {
        "total_bills": len(export_data["bills"]),
        "total_documents": len(export_data["documents"]),
        "total_payments": len(export_data["payments"]),
        "total_links": len(export_data["links"])
    }
    
    return export_data


def export_user_profile(user: User) -> Dict[str, Any]:
    """Export user profile without sensitive data"""
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "currency": user.currency,
        "theme": user.theme,
        "notifications_enabled": user.notifications_enabled,
        "default_reminder_days": getattr(user, 'default_reminder_days', 7),
        "default_bill_category": serialize_enum(getattr(user, 'default_bill_category', 'other')),
        "created_at": serialize_date(user.created_at),
        "updated_at": serialize_date(user.updated_at)
        # Excludes: hashed_password, is_active, is_bootstrapped
    }


def export_bill(bill: Bill, include_metadata: bool = True) -> Dict[str, Any]:
    """Export a single bill"""
    data = {
        "id": bill.id,
        "name": bill.name,
        "amount": bill.amount,
        "category": serialize_enum(bill.category),
        "due_date": serialize_date(bill.due_date),
        "frequency": serialize_enum(bill.frequency),
        "status": serialize_enum(bill.status),
        "is_auto_pay": bill.is_auto_pay,
        "notes": bill.notes,
        "reminder_days": bill.reminder_days
    }
    
    if include_metadata:
        data["created_at"] = serialize_date(bill.created_at)
        data["updated_at"] = serialize_date(bill.updated_at)
        data["is_deleted"] = getattr(bill, 'is_deleted', False)
        if getattr(bill, 'is_deleted', False):
            data["deleted_at"] = serialize_date(getattr(bill, 'deleted_at', None))
    
    return data


def export_document(doc: Document, include_metadata: bool = True) -> Dict[str, Any]:
    """Export a single document (excludes internal file_path)"""
    data = {
        "id": doc.id,
        "name": doc.name,
        "category": serialize_enum(doc.category),
        "expiry_date": serialize_date(doc.expiry_date) if doc.expiry_date else None,
        "is_protected": doc.is_protected,
        "notes": doc.notes,
        "tags": doc.tags,
        "file_type": doc.file_type,
        "original_filename": getattr(doc, 'original_filename', None),
        "file_size": getattr(doc, 'file_size', None),
        "has_file": doc.file_path is not None
        # Excludes: file_path (internal storage path), file_checksum (internal)
    }
    
    if include_metadata:
        data["created_at"] = serialize_date(doc.created_at)
        data["updated_at"] = serialize_date(doc.updated_at)
        data["uploaded_at"] = serialize_date(getattr(doc, 'uploaded_at', None))
        data["is_deleted"] = getattr(doc, 'is_deleted', False)
        if getattr(doc, 'is_deleted', False):
            data["deleted_at"] = serialize_date(getattr(doc, 'deleted_at', None))
    
    return data


def export_payment(payment: Payment, include_metadata: bool = True) -> Dict[str, Any]:
    """Export a single payment"""
    data = {
        "id": payment.id,
        "bill_id": payment.bill_id,
        "amount": payment.amount,
        "paid_date": serialize_date(payment.paid_date),
        "confirmation_number": payment.confirmation_number,
        "notes": payment.notes
    }
    
    if include_metadata:
        data["created_at"] = serialize_date(payment.created_at)
    
    return data


async def export_to_csv_format(
    user: User,
    db: AsyncSession,
    data_type: str = "bills"
) -> List[Dict[str, Any]]:
    """
    Export data in a flat format suitable for CSV export.
    
    Args:
        user: The user whose data to export
        db: Database session
        data_type: "bills" or "documents"
        
    Returns:
        List of flat dictionaries
    """
    if data_type == "bills":
        query = select(Bill).where(
            Bill.user_id == user.id,
            Bill.is_deleted == False
        ).order_by(Bill.due_date)
        
        result = await db.execute(query)
        bills = result.scalars().all()
        
        return [
            {
                "ID": bill.id,
                "Name": bill.name,
                "Amount": bill.amount,
                "Category": serialize_enum(bill.category),
                "Due Date": serialize_date(bill.due_date),
                "Frequency": serialize_enum(bill.frequency),
                "Status": serialize_enum(bill.status),
                "Auto Pay": "Yes" if bill.is_auto_pay else "No",
                "Reminder Days": bill.reminder_days,
                "Notes": bill.notes or "",
                "Created": serialize_date(bill.created_at),
                "Updated": serialize_date(bill.updated_at)
            }
            for bill in bills
        ]
    
    elif data_type == "documents":
        query = select(Document).where(
            Document.user_id == user.id,
            Document.is_deleted == False
        ).order_by(Document.name)
        
        result = await db.execute(query)
        documents = result.scalars().all()
        
        return [
            {
                "ID": doc.id,
                "Name": doc.name,
                "Category": serialize_enum(doc.category),
                "Expiry Date": serialize_date(doc.expiry_date) if doc.expiry_date else "",
                "Protected": "Yes" if doc.is_protected else "No",
                "Tags": doc.tags or "",
                "File Type": doc.file_type or "",
                "Original Filename": getattr(doc, 'original_filename', "") or "",
                "File Size (bytes)": getattr(doc, 'file_size', "") or "",
                "Notes": doc.notes or "",
                "Created": serialize_date(doc.created_at),
                "Updated": serialize_date(doc.updated_at)
            }
            for doc in documents
        ]
    
    return []
