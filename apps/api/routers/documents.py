"""Document management endpoints"""

from uuid import UUID, uuid4

import structlog
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_db
from db.models import Document, DocumentReadState, DocumentStatus, User
from schemas.documents import (
    DocumentListResponse,
    DocumentReadStateResponse,
    DocumentReadStateUpdate,
    DocumentResponse,
    UploadURLResponse,
)
from services.auth import get_current_user
from services.ingestion import IngestionService
from services.storage import StorageService

logger = structlog.get_logger()
router = APIRouter()
storage_service = StorageService()
ingestion_service = IngestionService()


@router.post("/documents/upload", response_model=UploadURLResponse)
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a document file to storage through the backend"""
    try:
        # Validate file type
        if file.content_type != "application/pdf":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only PDF files are allowed",
            )

        # Generate document ID
        document_id = uuid4()

        # Use provided title or derive from filename
        document_title = title or file.filename.replace(".pdf", "").replace(".PDF", "")
        original_filename = file.filename or "document.pdf"

        # Generate storage path
        storage_path = f"{current_user.id}/{document_id}.pdf"

        # Read file content
        file_content = await file.read()

        # Upload to storage using service role (bypasses RLS)
        await storage_service.upload_file(storage_path, file_content, file.content_type)

        # Create document record
        document = Document(
            id=document_id,
            owner_id=current_user.id,
            title=document_title,
            original_filename=original_filename,
            storage_path=storage_path,
            status=DocumentStatus.UPLOADED,
        )
        db.add(document)
        await db.commit()

        logger.info(
            "Document uploaded successfully",
            document_id=str(document_id),
            user_id=str(current_user.id),
            filename=original_filename,
        )

        return UploadURLResponse(
            document_id=document_id,
            storage_path=storage_path,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to upload document", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload document: {str(e)}",
        )


@router.post("/documents/{document_id}/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trigger document ingestion (PDF processing and chunking)"""
    # Verify document ownership
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.owner_id == current_user.id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Wrapper function to ensure errors are logged
    async def ingest_with_error_handling(doc_id: UUID):
        """Wrapper to catch and log any errors in background task"""
        try:
            logger.info("Starting background ingestion task", document_id=str(doc_id))
            result = await ingestion_service.ingest_document(doc_id, None)
            if result:
                logger.info("Background ingestion completed successfully", document_id=str(doc_id))
            else:
                logger.error("Background ingestion failed", document_id=str(doc_id))
        except Exception as e:
            logger.error(
                "CRITICAL: Background ingestion task crashed",
                document_id=str(doc_id),
                error=str(e),
                exc_info=e,
            )
            # Also print to stderr as fallback
            import sys
            import traceback

            print(f"ERROR: Background task failed for document {doc_id}: {e}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)

    # Add ingestion task to background
    background_tasks.add_task(ingest_with_error_handling, document.id)

    logger.info("Queued document for ingestion", document_id=str(document_id))

    return {"status": "queued", "document_id": str(document_id)}


@router.get("/documents", response_model=DocumentListResponse)
async def list_documents(
    status_filter: DocumentStatus | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List user's documents with optional status filter"""
    # Build query
    query = select(Document).where(Document.owner_id == current_user.id)

    if status_filter:
        query = query.where(Document.status == status_filter)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Get documents
    query = query.order_by(Document.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    documents = result.scalars().all()

    return DocumentListResponse(
        documents=[DocumentResponse.model_validate(doc) for doc in documents],
        total=total,
    )


@router.get("/documents/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single document by ID"""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.owner_id == current_user.id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return DocumentResponse.model_validate(document)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a document"""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.owner_id == current_user.id)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete from storage
    await storage_service.delete_file(document.storage_path)

    # Delete from database (cascades to chunks, etc.)
    await db.delete(document)
    await db.commit()

    logger.info("Deleted document", document_id=str(document_id))


@router.get("/documents/{document_id}/read-state", response_model=DocumentReadStateResponse)
async def get_read_state(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's read state for a document"""
    # Verify document exists and user owns it
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.owner_id == current_user.id)
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get or create read state
    result = await db.execute(
        select(DocumentReadState).where(
            DocumentReadState.user_id == current_user.id,
            DocumentReadState.document_id == document_id,
        )
    )
    read_state = result.scalar_one_or_none()

    if not read_state:
        # Create default read state
        read_state = DocumentReadState(
            user_id=current_user.id,
            document_id=document.id,
            last_page=1,
            is_read=False,
        )
        db.add(read_state)
        await db.commit()
        await db.refresh(read_state)

    return DocumentReadStateResponse.model_validate(read_state)


@router.put("/documents/{document_id}/read-state", response_model=DocumentReadStateResponse)
async def update_read_state(
    document_id: str,
    update: DocumentReadStateUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user's read state for a document"""
    # Verify document exists and user owns it
    doc_result = await db.execute(
        select(Document).where(Document.id == document_id, Document.owner_id == current_user.id)
    )
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get or create read state
    result = await db.execute(
        select(DocumentReadState).where(
            DocumentReadState.user_id == current_user.id,
            DocumentReadState.document_id == document_id,
        )
    )
    read_state = result.scalar_one_or_none()

    if not read_state:
        read_state = DocumentReadState(
            user_id=current_user.id,
            document_id=document.id,
            last_page=update.last_page,
            is_read=update.is_read,
        )
        db.add(read_state)
    else:
        read_state.last_page = update.last_page
        read_state.is_read = update.is_read

    await db.commit()
    await db.refresh(read_state)

    return DocumentReadStateResponse.model_validate(read_state)
