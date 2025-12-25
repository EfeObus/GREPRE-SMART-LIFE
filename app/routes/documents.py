"""
GrePre Smart Life - Document Routes
With strict ownership enforcement, soft deletes, file metadata, and transaction safety
"""
import os
import uuid
import hashlib
from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
import aiofiles
from app.core.database import get_db
from app.core.config import settings
from app.core.exceptions import ErrorCode
from app.models import Document, User, DocumentCategory
from app.schemas import DocumentCreate, DocumentUpdate, DocumentResponse
from app.routes.auth import get_current_user

router = APIRouter(prefix="/documents", tags=["Documents"])

# Allowed file types and max file size
ALLOWED_MIME_TYPES = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


async def get_user_document(
    document_id: int,
    user_id: int,
    db: AsyncSession,
    include_deleted: bool = False
) -> Document:
    """
    Get a document with strict ownership check.
    Raises appropriate errors if not found or access denied.
    """
    query = select(Document).where(Document.id == document_id)
    
    if not include_deleted:
        query = query.where(Document.is_deleted == False)
    
    result = await db.execute(query)
    document = result.scalar_one_or_none()
    
    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": ErrorCode.DOC_NOT_FOUND, "message": "Document not found"}
        )
    
    # Strict ownership check
    if document.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": ErrorCode.DOC_ACCESS_DENIED, "message": "You do not have access to this document"}
        )
    
    return document


def calculate_file_checksum(content: bytes) -> str:
    """Calculate SHA-256 checksum of file content"""
    return hashlib.sha256(content).hexdigest()


async def validate_file(file: UploadFile) -> tuple[bytes, str]:
    """
    Validate file type and size.
    Returns file content and checksum.
    """
    content = await file.read()
    
    # Check file size
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.DOC_FILE_TOO_LARGE, "message": f"File size exceeds {MAX_FILE_SIZE // (1024*1024)}MB limit"}
        )
    
    # Check MIME type
    if file.content_type and file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.DOC_INVALID_TYPE, "message": f"File type '{file.content_type}' is not allowed"}
        )
    
    checksum = calculate_file_checksum(content)
    return content, checksum


@router.get("", response_model=List[DocumentResponse])
async def get_documents(
    category: Optional[DocumentCategory] = None,
    search: Optional[str] = None,
    expiring_soon: bool = False,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all documents for the current user with ownership enforcement"""
    # Base query with ownership filter
    if include_deleted:
        query = select(Document).where(Document.user_id == current_user.id)
    else:
        query = select(Document).where(
            and_(
                Document.user_id == current_user.id,
                Document.is_deleted == False
            )
        )
    
    if category:
        query = query.where(Document.category == category)
    if search:
        query = query.where(Document.name.ilike(f"%{search}%"))
    if expiring_soon:
        threshold = date.today() + timedelta(days=30)
        query = query.where(
            and_(
                Document.expiry_date.isnot(None),
                Document.expiry_date <= threshold,
                Document.expiry_date >= date.today()
            )
        )
    
    query = query.order_by(Document.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single document with ownership enforcement"""
    return await get_user_document(document_id, current_user.id, db)


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    name: str = Form(...),
    category: DocumentCategory = Form(DocumentCategory.OTHER),
    expiry_date: Optional[date] = Form(None),
    is_protected: bool = Form(False),
    notes: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new document with file metadata and transaction safety"""
    file_path = None
    file_type = None
    original_filename = None
    file_size = None
    file_checksum = None
    
    try:
        if file and file.filename:
            # Validate and read file
            content, checksum = await validate_file(file)
            
            # Ensure upload directory exists
            os.makedirs(settings.upload_dir, exist_ok=True)
            
            # Store original filename and generate unique storage name
            original_filename = file.filename
            ext = os.path.splitext(file.filename)[1] if file.filename else ""
            unique_filename = f"{uuid.uuid4()}{ext}"
            file_path = os.path.join(settings.upload_dir, unique_filename)
            file_type = file.content_type
            file_size = len(content)
            file_checksum = checksum
            
            # Save file
            async with aiofiles.open(file_path, "wb") as f:
                await f.write(content)
        
        document = Document(
            user_id=current_user.id,
            name=name,
            category=category,
            expiry_date=expiry_date,
            is_protected=is_protected,
            notes=notes,
            tags=tags,
            file_path=file_path,
            file_type=file_type,
            original_filename=original_filename,
            file_size=file_size,
            file_checksum=file_checksum,
            uploaded_at=datetime.utcnow() if file else None,
            is_deleted=False
        )
        db.add(document)
        await db.commit()
        await db.refresh(document)
        return document
    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        # Clean up file if saved
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": ErrorCode.TRANSACTION_FAILED, "message": f"Failed to create document: {str(e)}"}
        )


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_data: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a document with ownership enforcement and transaction safety"""
    document = await get_user_document(document_id, current_user.id, db)
    
    try:
        update_data = document_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(document, field, value)
        
        await db.commit()
        await db.refresh(document)
        return document
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": ErrorCode.TRANSACTION_FAILED, "message": f"Failed to update document: {str(e)}"}
        )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    permanent: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a document (soft delete by default).
    Use permanent=True for permanent deletion (also deletes file).
    """
    document = await get_user_document(document_id, current_user.id, db, include_deleted=True)
    
    try:
        if permanent:
            # Delete file if exists
            if document.file_path and os.path.exists(document.file_path):
                os.remove(document.file_path)
            await db.delete(document)
        else:
            document.soft_delete()
        
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": ErrorCode.TRANSACTION_FAILED, "message": f"Failed to delete document: {str(e)}"}
        )


@router.post("/{document_id}/restore", response_model=DocumentResponse)
async def restore_document(
    document_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Restore a soft-deleted document"""
    document = await get_user_document(document_id, current_user.id, db, include_deleted=True)
    
    if not document.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": ErrorCode.DOC_NOT_FOUND, "message": "Document is not deleted"}
        )
    
    try:
        document.is_deleted = False
        document.deleted_at = None
        
        await db.commit()
        await db.refresh(document)
        return document
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": ErrorCode.TRANSACTION_FAILED, "message": f"Failed to restore document: {str(e)}"}
        )
