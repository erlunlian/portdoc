"""Document management endpoints"""

from uuid import UUID, uuid4

import httpx
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
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import get_db
from db.models import Document, DocumentReadState, DocumentStatus
from schemas.documents import (
    ArxivUploadRequest,
    DocumentListResponse,
    DocumentReadStateResponse,
    DocumentReadStateUpdate,
    DocumentResponse,
    DocumentUpdate,
    UploadURLResponse,
)
from services.ingestion import IngestionService
from services.storage import StorageService

logger = structlog.get_logger()
router = APIRouter()
storage_service = StorageService()
ingestion_service = IngestionService()


@router.post("/documents/upload", response_model=UploadURLResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(None),
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
        storage_path = f"{document_id}.pdf"

        # Read file content
        file_content = await file.read()

        # Upload to local storage
        await storage_service.upload_file(storage_path, file_content, file.content_type)

        # Create document record
        document = Document(
            id=document_id,
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
            filename=original_filename,
        )

        # Automatically trigger ingestion in the background
        async def ingest_uploaded_document(doc_id: UUID):
            """Background task to automatically ingest the uploaded document"""
            try:
                logger.info(
                    "Starting automatic ingestion for uploaded document", document_id=str(doc_id)
                )
                result = await ingestion_service.ingest_document(doc_id, None)
                if result:
                    logger.info(
                        "Automatic ingestion completed successfully", document_id=str(doc_id)
                    )
                else:
                    logger.error("Automatic ingestion failed", document_id=str(doc_id))
            except Exception as e:
                logger.error(
                    "Error during automatic ingestion",
                    document_id=str(doc_id),
                    error=str(e),
                    exc_info=e,
                )

        background_tasks.add_task(ingest_uploaded_document, document_id)
        logger.info("Queued document for automatic ingestion", document_id=str(document_id))

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


@router.post("/documents/upload-arxiv", response_model=UploadURLResponse)
async def upload_arxiv_document(
    background_tasks: BackgroundTasks,
    request: ArxivUploadRequest,
    db: AsyncSession = Depends(get_db),
):
    """Upload a document from an arxiv URL"""
    try:
        # Download PDF from arxiv
        try:
            pdf_content, title = await ingestion_service.download_arxiv_pdf(request.arxiv_url)
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e),
            )
        except httpx.HTTPError as e:
            logger.error("Failed to download arxiv PDF", error=str(e), url=request.arxiv_url)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to download PDF from arxiv: {str(e)}",
            )

        # Generate document ID
        document_id = uuid4()

        # Generate storage path
        storage_path = f"{document_id}.pdf"

        # Upload to local storage
        await storage_service.upload_file(storage_path, pdf_content, "application/pdf")

        # Create document record
        document = Document(
            id=document_id,
            title=title,
            original_filename=f"{title}.pdf",
            storage_path=storage_path,
            status=DocumentStatus.UPLOADED,
        )
        db.add(document)
        await db.commit()

        logger.info(
            "Arxiv document uploaded successfully",
            document_id=str(document_id),
            arxiv_url=request.arxiv_url,
            title=title,
        )

        # Automatically trigger ingestion in the background
        async def ingest_uploaded_document(doc_id: UUID):
            """Background task to automatically ingest the uploaded document"""
            try:
                logger.info(
                    "Starting automatic ingestion for arxiv document", document_id=str(doc_id)
                )
                result = await ingestion_service.ingest_document(doc_id, None)
                if result:
                    logger.info(
                        "Automatic ingestion completed successfully", document_id=str(doc_id)
                    )
                else:
                    logger.error("Automatic ingestion failed", document_id=str(doc_id))
            except Exception as e:
                logger.error(
                    "Error during automatic ingestion",
                    document_id=str(doc_id),
                    error=str(e),
                    exc_info=e,
                )

        background_tasks.add_task(ingest_uploaded_document, document_id)
        logger.info("Queued arxiv document for automatic ingestion", document_id=str(document_id))

        return UploadURLResponse(
            document_id=document_id,
            storage_path=storage_path,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to upload arxiv document", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload arxiv document: {str(e)}",
        )


@router.post("/documents/{document_id}/ingest", status_code=status.HTTP_202_ACCEPTED)
async def ingest_document(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Trigger document ingestion (PDF processing and chunking)"""
    # Verify document exists
    result = await db.execute(select(Document).where(Document.id == document_id))
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

            logger.error(
                f"ERROR: Background task failed for document {doc_id}: {e}", file=sys.stderr
            )
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
    db: AsyncSession = Depends(get_db),
):
    """List all documents with optional status filter"""
    # Build query
    query = select(Document)

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
    db: AsyncSession = Depends(get_db),
):
    """Get a single document by ID"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    return DocumentResponse.model_validate(document)


@router.patch("/documents/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: str,
    update: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update a document's metadata"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Update document title
    document.title = update.title

    await db.commit()
    await db.refresh(document)

    logger.info("Updated document", document_id=str(document_id), title=update.title)

    return DocumentResponse.model_validate(document)


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a document"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Delete from storage
    await storage_service.delete_file(document.storage_path)

    # Delete from database (cascades to chunks, etc.)
    await db.delete(document)
    await db.commit()

    logger.info("Deleted document", document_id=str(document_id))


@router.get("/documents/{document_id}/pdf")
async def get_document_pdf(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Serve the PDF file for a document"""
    result = await db.execute(select(Document).where(Document.id == document_id))
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get file path from storage service
    file_path = await storage_service.get_file_url(document.storage_path)

    try:
        return FileResponse(
            file_path,
            media_type="application/pdf",
            filename=document.original_filename,
        )
    except FileNotFoundError:
        logger.error("PDF file not found", document_id=str(document_id), path=file_path)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="PDF file not found in storage",
        )


@router.get("/documents/{document_id}/read-state", response_model=DocumentReadStateResponse)
async def get_read_state(
    document_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get read state for a document"""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get or create read state
    result = await db.execute(
        select(DocumentReadState).where(DocumentReadState.document_id == document_id)
    )
    read_state = result.scalar_one_or_none()

    if not read_state:
        # Create default read state
        read_state = DocumentReadState(
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
    db: AsyncSession = Depends(get_db),
):
    """Update read state for a document"""
    # Verify document exists
    doc_result = await db.execute(select(Document).where(Document.id == document_id))
    document = doc_result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    # Get or create read state
    result = await db.execute(
        select(DocumentReadState).where(DocumentReadState.document_id == document_id)
    )
    read_state = result.scalar_one_or_none()

    if not read_state:
        read_state = DocumentReadState(
            document_id=document.id,
            last_page=update.last_page,
            scale=update.scale,
            is_read=update.is_read,
        )
        db.add(read_state)
    else:
        read_state.last_page = update.last_page
        read_state.scale = update.scale
        read_state.is_read = update.is_read

    await db.commit()
    await db.refresh(read_state)

    return DocumentReadStateResponse.model_validate(read_state)
