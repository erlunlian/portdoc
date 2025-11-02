"""Pydantic schemas for search"""

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    """Schema for search request"""

    document_id: UUID
    query: str = Field(..., min_length=1, max_length=500)
    k: int = Field(8, ge=1, le=50)
    page_filter: Optional[tuple[int, int]] = None  # (min_page, max_page)


class SearchResult(BaseModel):
    """Schema for a search result"""

    chunk_id: str
    page: int
    text: str
    similarity: float


class SearchResponse(BaseModel):
    """Schema for search response"""

    results: list[SearchResult]
    total: int
