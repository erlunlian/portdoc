"""Pydantic schemas for highlights"""

from datetime import datetime
from typing import List
from uuid import UUID

from pydantic import BaseModel, Field


class HighlightRect(BaseModel):
    """Schema for a highlight rectangle"""

    x: float
    y: float
    width: float
    height: float


class HighlightCreate(BaseModel):
    """Schema for creating a highlight"""

    page: int = Field(..., ge=1)
    rects: List[HighlightRect] = Field(..., min_length=1)
    text: str = Field(..., min_length=1)


class HighlightResponse(BaseModel):
    """Schema for highlight response"""

    id: UUID
    document_id: UUID
    page: int
    rects: List[dict]
    text: str
    created_at: datetime

    class Config:
        from_attributes = True


class HighlightListResponse(BaseModel):
    """Schema for list of highlights"""

    highlights: list[HighlightResponse]
    total: int
