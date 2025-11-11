"""Highlight management endpoints"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_db
from db.models import Document, Highlight
from schemas.highlights import HighlightCreate, HighlightListResponse, HighlightResponse

logger = structlog.get_logger()
router = APIRouter()


@router.get("/documents/{document_id}/highlights", response_model=HighlightListResponse)
async def list_highlights(
    document_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List highlights for a document"""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get total count
    count_query = select(func.count()).where(Highlight.document_id == document_id)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get highlights
    query = (
        select(Highlight)
        .where(Highlight.document_id == document_id)
        .order_by(Highlight.page, Highlight.created_at)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    highlights = result.scalars().all()

    return HighlightListResponse(
        highlights=[HighlightResponse.model_validate(h) for h in highlights],
        total=total,
    )


@router.post("/documents/{document_id}/highlights", response_model=HighlightResponse)
async def create_highlight(
    document_id: str,
    highlight_create: HighlightCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new highlight"""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Create highlight
    highlight = Highlight(
        document_id=document.id,
        page=highlight_create.page,
        rects=[rect.model_dump() for rect in highlight_create.rects],
        text=highlight_create.text,
    )
    db.add(highlight)
    await db.commit()
    await db.refresh(highlight)

    logger.info(
        "Created highlight",
        highlight_id=str(highlight.id),
        document_id=str(document_id),
        page=highlight_create.page,
    )

    return HighlightResponse.model_validate(highlight)


@router.delete("/highlights/{highlight_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_highlight(
    highlight_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a highlight"""
    result = await db.execute(select(Highlight).where(Highlight.id == highlight_id))
    highlight = result.scalar_one_or_none()

    if not highlight:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Highlight not found")

    await db.delete(highlight)
    await db.commit()

    logger.info("Deleted highlight", highlight_id=str(highlight_id))
