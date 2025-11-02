"""Pydantic schemas for threads and messages"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from db.models import MessageRole


class ThreadCreate(BaseModel):
    """Schema for creating a thread"""

    document_id: UUID
    title: Optional[str] = Field(None, max_length=500)


class ThreadResponse(BaseModel):
    """Schema for thread response"""

    id: UUID
    user_id: UUID
    document_id: UUID
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ThreadListResponse(BaseModel):
    """Schema for list of threads"""

    threads: list[ThreadResponse]
    total: int


class MessageCreate(BaseModel):
    """Schema for creating a message"""

    content: str = Field(..., min_length=1, max_length=10000)
    selection_context: Optional[dict] = None  # For highlight context


class MessageResponse(BaseModel):
    """Schema for message response"""

    id: UUID
    thread_id: UUID
    role: MessageRole
    content: str
    tokens_prompt: Optional[int] = None
    tokens_completion: Optional[int] = None
    metadata: Optional[dict] = Field(None, alias="message_metadata")
    created_at: datetime

    class Config:
        from_attributes = True
        populate_by_name = True


class MessageListResponse(BaseModel):
    """Schema for list of messages"""

    messages: list[MessageResponse]
    total: int


class StreamChunk(BaseModel):
    """Schema for SSE stream chunk"""

    type: str  # "token", "done", "error"
    content: Optional[str] = None
    metadata: Optional[dict] = None
