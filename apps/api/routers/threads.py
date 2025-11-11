"""Thread and message endpoints with SSE streaming"""

import json
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_db
from db.models import Document, Message, MessageRole, Thread
from schemas.threads import (
    MessageCreate,
    MessageListResponse,
    MessageResponse,
    ThreadCreate,
    ThreadListResponse,
    ThreadResponse,
)
from services.rag import RAGService

logger = structlog.get_logger()
router = APIRouter()
rag_service = RAGService()


@router.post("/threads", response_model=ThreadResponse)
async def create_thread(
    thread_create: ThreadCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new chat thread for a document"""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == thread_create.document_id))
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Create thread
    thread = Thread(
        document_id=document.id,
        title=thread_create.title or "New Chat",
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)

    logger.info("Created thread", thread_id=str(thread.id), document_id=str(document.id))

    return ThreadResponse.model_validate(thread)


@router.get("/threads", response_model=ThreadListResponse)
async def list_threads(
    document_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List all threads, optionally filtered by document"""
    query = select(Thread)

    if document_id:
        # Verify document exists
        doc_result = await db.execute(select(Document).where(Document.id == document_id))
        document = doc_result.scalar_one_or_none()
        if not document:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

        query = query.where(Thread.document_id == document_id)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get threads
    query = query.order_by(Thread.updated_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    threads = result.scalars().all()

    return ThreadListResponse(
        threads=[ThreadResponse.model_validate(t) for t in threads],
        total=total,
    )


@router.get("/threads/{thread_id}", response_model=ThreadResponse)
async def get_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get a single thread by ID"""
    result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    return ThreadResponse.model_validate(thread)


@router.get("/threads/{thread_id}/messages", response_model=MessageListResponse)
async def list_messages(
    thread_id: str,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    """List messages in a thread"""
    # Verify thread exists
    thread_result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = thread_result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Get total count
    count_query = select(func.count()).where(Message.thread_id == thread_id)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get messages
    query = (
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at)
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    messages = result.scalars().all()

    return MessageListResponse(
        messages=[MessageResponse.model_validate(m) for m in messages],
        total=total,
    )


@router.post("/threads/{thread_id}/messages", status_code=status.HTTP_202_ACCEPTED)
async def send_message(
    thread_id: str,
    message_create: MessageCreate,
    db: AsyncSession = Depends(get_db),
):
    """Send a message and trigger LLM response (use /stream endpoint for streaming)"""
    # Verify thread exists and get thread
    thread_result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = thread_result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    logger.info("Message sent, use /stream endpoint for response", thread_id=str(thread_id))

    return {
        "status": "accepted",
        "thread_id": str(thread_id),
        "stream_url": f"/v1/threads/{thread_id}/stream",
    }


@router.post("/threads/start-chat")
async def start_chat(
    document_id: str = Query(...),
    query: str = Query(..., min_length=1, max_length=5000),
    page_context: Optional[int] = Query(None, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Start a new chat: create thread, generate title, and stream response"""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Create new thread
    thread = Thread(
        document_id=document.id,
        title="New Chat",  # Temporary title
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)

    # Capture thread.id as a local variable to avoid lazy loading issues in async context
    thread_id = thread.id

    logger.info("Created thread for start-chat", thread_id=str(thread_id))

    # Save user message
    user_msg = Message(
        thread_id=thread_id,
        role=MessageRole.USER,
        content=query,
        tokens_prompt=len(query) // 4,  # Rough estimate
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    # Generate title for the thread
    generated_title = None
    try:
        generated_title = await rag_service.generate_thread_title(query)
        thread.title = generated_title
        await db.commit()
        logger.info(f"Generated title for new thread {thread_id}: {generated_title}")
    except Exception as e:
        logger.error(f"Failed to generate thread title: {str(e)}")

    # Get message history (will be just the one message we added)
    message_history = [user_msg]

    # Determine page filter for retrieval
    page_filter = None
    if page_context:
        # Search within +/- 5 pages of current page
        page_filter = (max(1, page_context - 5), page_context + 5)

    # Retrieve relevant chunks
    chunks = await rag_service.retrieve_chunks(
        document_id=document.id,
        query=query,
        k=8,
        page_filter=page_filter,
        db=db,
    )

    if not chunks:
        logger.warning("No chunks retrieved for query", thread_id=str(thread_id))

    # Validate LLM connection before starting SSE stream
    try:
        await rag_service.validate_llm_connection()
    except Exception as e:
        logger.error(f"LLM validation failed: {str(e)}", thread_id=str(thread_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect to language model: {str(e)}",
        )

    async def event_generator():
        """Generate SSE events"""
        try:
            # Send start event with thread info
            start_event = {
                "type": "start",
                "thread_id": str(thread_id),
                "title": generated_title or "New Chat",
            }
            yield f"data: {json.dumps(start_event)}\n\n"

            # Stream tokens from LLM
            full_response = ""
            async for token in rag_service.generate_response(
                thread_id=thread_id,
                user_message=query,
                chunks=chunks,
                message_history=message_history,
                db=db,
            ):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Send done event with metadata
            pages = sorted(set(chunk["page"] for chunk in chunks)) if chunks else []
            yield f"data: {json.dumps({'type': 'done', 'metadata': {'pages': pages}})}\n\n"

        except Exception as e:
            logger.error("Streaming error", error=str(e), thread_id=str(thread_id), exc_info=True)
            # Send error event to client
            error_message = f"Failed to generate response: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_message})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/threads/{thread_id}/stream")
async def stream_response(
    thread_id: str,
    query: str = Query(..., min_length=1, max_length=5000),
    page_context: Optional[int] = Query(None, ge=1),
    db: AsyncSession = Depends(get_db),
):
    """Stream LLM response using Server-Sent Events (SSE)"""
    # Verify thread exists and get thread with document
    thread_result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = thread_result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    # Check if this is the first message in the thread (for title generation)
    existing_messages_result = await db.execute(
        select(func.count(Message.id)).where(Message.thread_id == thread_id)
    )
    existing_message_count = existing_messages_result.scalar() or 0
    is_first_message = existing_message_count == 0

    # Save user message immediately
    user_msg = Message(
        thread_id=thread.id,
        role=MessageRole.USER,
        content=query,
        tokens_prompt=len(query) // 4,  # Rough estimate
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    # Generate title for new threads
    generated_title = None
    if is_first_message and (thread.title is None or thread.title == "New Chat"):
        try:
            generated_title = await rag_service.generate_thread_title(query)
            thread.title = generated_title
            await db.commit()
            logger.info(f"Generated title for thread {thread_id}: {generated_title}")
        except Exception as e:
            logger.error(f"Failed to generate thread title: {str(e)}")

    # Get message history
    history_result = await db.execute(
        select(Message).where(Message.thread_id == thread_id).order_by(Message.created_at)
    )
    message_history = list(history_result.scalars().all())

    # Determine page filter for retrieval
    page_filter = None
    if page_context:
        # Search within +/- 5 pages of current page
        page_filter = (max(1, page_context - 5), page_context + 5)

    # Retrieve relevant chunks
    chunks = await rag_service.retrieve_chunks(
        document_id=thread.document_id,
        query=query,
        k=8,
        page_filter=page_filter,
        db=db,
    )

    if not chunks:
        logger.warning("No chunks retrieved for query", thread_id=str(thread_id))

    # Validate LLM connection before starting SSE stream
    # This ensures we return proper HTTP errors if the LLM is misconfigured
    try:
        await rag_service.validate_llm_connection()
    except Exception as e:
        logger.error(f"LLM validation failed: {str(e)}", thread_id=str(thread_id))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to connect to language model: {str(e)}",
        )

    async def event_generator():
        """Generate SSE events"""
        try:
            # Send start event with title if generated
            start_event = {"type": "start"}
            if generated_title:
                start_event["title"] = generated_title
            yield f"data: {json.dumps(start_event)}\n\n"

            # Collect the full response first to catch any errors before streaming
            full_response = ""
            pages = []

            # Stream tokens from LLM
            async for token in rag_service.generate_response(
                thread_id=thread.id,
                user_message=query,
                chunks=chunks,
                message_history=message_history,
                db=db,
            ):
                full_response += token
                yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

            # Send done event with metadata
            pages = sorted(set(chunk["page"] for chunk in chunks))
            yield f"data: {json.dumps({'type': 'done', 'metadata': {'pages': pages}})}\n\n"

        except Exception as e:
            logger.error("Streaming error", error=str(e), thread_id=str(thread_id), exc_info=True)
            # Send error event to client
            error_message = f"Failed to generate response: {str(e)}"
            yield f"data: {json.dumps({'type': 'error', 'content': error_message})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.patch("/threads/{thread_id}", response_model=ThreadResponse)
async def update_thread(
    thread_id: str,
    title: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Update a thread (currently only title)"""
    result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    if title is not None:
        thread.title = title

    await db.commit()
    await db.refresh(thread)

    logger.info("Updated thread", thread_id=str(thread_id), title=title)
    return ThreadResponse.model_validate(thread)


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a thread"""
    result = await db.execute(select(Thread).where(Thread.id == thread_id))
    thread = result.scalar_one_or_none()

    if not thread:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")

    await db.delete(thread)
    await db.commit()

    logger.info("Deleted thread", thread_id=str(thread_id))
