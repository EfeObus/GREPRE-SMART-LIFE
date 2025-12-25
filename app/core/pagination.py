"""
GrePre Smart Life - Pagination Utilities
Standardized pagination for list endpoints
"""
from typing import TypeVar, Generic, List, Optional
from pydantic import BaseModel, Field
from fastapi import Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class PaginationParams:
    """
    Dependency for extracting pagination parameters from query string.
    Usage: pagination: PaginationParams = Depends()
    """
    def __init__(
        self,
        page: int = Query(1, ge=1, description="Page number"),
        page_size: int = Query(20, ge=1, le=100, description="Items per page"),
        sort_by: Optional[str] = Query(None, description="Field to sort by"),
        sort_order: str = Query("asc", regex="^(asc|desc)$", description="Sort order")
    ):
        self.page = page
        self.page_size = page_size
        self.skip = (page - 1) * page_size
        self.sort_by = sort_by
        self.sort_order = sort_order


class PaginatedResponse(BaseModel, Generic[T]):
    """
    Standard paginated response wrapper.
    """
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_prev: bool
    
    class Config:
        from_attributes = True


def create_paginated_response(
    items: List[T],
    total: int,
    page: int,
    page_size: int
) -> dict:
    """
    Create a paginated response dictionary.
    """
    total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "has_next": page < total_pages,
        "has_prev": page > 1
    }


async def paginate_query(
    query,
    db: AsyncSession,
    pagination: PaginationParams,
    model=None,
    sort_field=None
) -> dict:
    """
    Apply pagination to a SQLAlchemy query.
    Returns paginated response with items and metadata.
    """
    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    result = await db.execute(count_query)
    total = result.scalar() or 0
    
    # Apply sorting if specified
    if sort_field is not None:
        if pagination.sort_order == "desc":
            query = query.order_by(sort_field.desc())
        else:
            query = query.order_by(sort_field.asc())
    
    # Apply pagination
    query = query.offset(pagination.skip).limit(pagination.page_size)
    
    # Execute query
    result = await db.execute(query)
    items = result.scalars().all()
    
    return create_paginated_response(
        items=items,
        total=total,
        page=pagination.page,
        page_size=pagination.page_size
    )


class CursorPaginationParams:
    """
    Cursor-based pagination for large datasets.
    More efficient than offset pagination for large tables.
    """
    def __init__(
        self,
        cursor: Optional[int] = Query(None, description="Cursor (last item ID)"),
        limit: int = Query(20, ge=1, le=100, description="Items to return")
    ):
        self.cursor = cursor
        self.limit = limit


def create_cursor_response(
    items: List[T],
    limit: int,
    id_field: str = "id"
) -> dict:
    """
    Create cursor-based paginated response.
    """
    next_cursor = None
    if items and len(items) == limit:
        last_item = items[-1]
        next_cursor = getattr(last_item, id_field, None)
    
    return {
        "items": items,
        "next_cursor": next_cursor,
        "has_more": len(items) == limit
    }
