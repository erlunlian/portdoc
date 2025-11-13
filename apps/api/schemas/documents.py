"""Pydantic schemas for documents"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from db.models import DocumentStatus


class DocumentResponse(BaseModel):
    """Schema for document response"""

    id: UUID
    title: str
    original_filename: str
    storage_path: str
    pages: int | None = None
    size_bytes: int | None = None
    status: DocumentStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentListResponse(BaseModel):
    """Schema for list of documents"""

    documents: list[DocumentResponse]
    total: int


class UploadURLResponse(BaseModel):
    """Schema for upload response"""

    document_id: UUID
    storage_path: str


class DocumentUpdate(BaseModel):
    """Schema for updating document"""

    title: str = Field(..., min_length=1, max_length=500)


class DocumentReadStateUpdate(BaseModel):
    """Schema for updating read state"""

    last_page: int = Field(..., ge=1)
    scale: float | None = Field(None, ge=0.1, le=10.0)
    is_read: bool = False


class DocumentReadStateResponse(BaseModel):
    """Schema for read state response"""

    id: UUID
    document_id: UUID
    last_page: int
    scale: float | None
    is_read: bool
    updated_at: datetime

    class Config:
        from_attributes = True


class ArxivUploadRequest(BaseModel):
    """Schema for arxiv URL upload"""

    arxiv_url: str = Field(..., min_length=1, max_length=500)
