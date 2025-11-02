"""Search endpoints"""

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_db
from db.models import Document, User
from schemas.search import SearchRequest, SearchResponse, SearchResult
from services.auth import get_current_user
from services.rag import RAGService

logger = structlog.get_logger()
router = APIRouter()
rag_service = RAGService()


@router.post("/search", response_model=SearchResponse)
async def search_document(
    search_request: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Semantic search over document chunks"""
    # Verify document ownership
    doc_result = await db.execute(
        select(Document).where(
            Document.id == search_request.document_id,
            Document.owner_id == current_user.id,
        )
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Retrieve chunks
    chunks = await rag_service.retrieve_chunks(
        document_id=search_request.document_id,
        query=search_request.query,
        k=search_request.k,
        page_filter=search_request.page_filter,
        db=db,
    )

    # Convert to response format
    results = [
        SearchResult(
            chunk_id=chunk["chunk_id"],
            page=chunk["page"],
            text=chunk["text"],
            similarity=chunk["similarity"],
        )
        for chunk in chunks
    ]

    logger.info(
        "Search completed",
        document_id=str(search_request.document_id),
        results_count=len(results),
    )

    return SearchResponse(results=results, total=len(results))
