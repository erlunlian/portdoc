"""PDF ingestion service for text extraction and chunking"""

import re
from uuid import UUID

import fitz  # PyMuPDF
import httpx
import structlog
import tiktoken
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from db.base import AsyncSessionLocal
from db.models import Chunk, Document, DocumentStatus
from services.embeddings import EmbeddingService
from services.storage import StorageService

logger = structlog.get_logger()


class IngestionService:
    """Service for ingesting PDFs and creating chunks with embeddings"""

    def __init__(self):
        self.storage = StorageService()
        self.embedding = EmbeddingService()
        self.encoding = tiktoken.get_encoding("cl100k_base")  # OpenAI-compatible tokenizer
        self.chunk_size = 1000  # tokens
        self.chunk_overlap = 200  # tokens

    def parse_arxiv_id(self, arxiv_url: str) -> str | None:
        """
        Extract arxiv paper ID from URL
        Supports formats like:
        - https://arxiv.org/abs/2301.07041
        - https://arxiv.org/pdf/2301.07041.pdf
        - arxiv.org/abs/2301.07041
        - 2301.07041
        """
        # Remove whitespace
        arxiv_url = arxiv_url.strip()

        # Pattern to match arxiv ID (YYMM.NNNNN or YYMM.NNNNNV)
        arxiv_id_pattern = r"(\d{4}\.\d{4,5}(?:v\d+)?)"

        match = re.search(arxiv_id_pattern, arxiv_url)
        if match:
            return match.group(1)

        return None

    async def download_arxiv_pdf(self, arxiv_url: str) -> tuple[bytes, str]:
        """
        Download PDF from arxiv URL
        Returns (pdf_bytes, title)
        """
        arxiv_id = self.parse_arxiv_id(arxiv_url)
        if not arxiv_id:
            raise ValueError(f"Invalid arxiv URL: {arxiv_url}")

        # Remove version suffix if present for the download URL
        arxiv_id_no_version = re.sub(r"v\d+$", "", arxiv_id)

        # Construct PDF download URL
        pdf_url = f"https://arxiv.org/pdf/{arxiv_id_no_version}.pdf"

        logger.info("Downloading arxiv PDF", arxiv_id=arxiv_id, url=pdf_url)

        async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
            response = await client.get(pdf_url)
            response.raise_for_status()

            if response.headers.get("content-type") != "application/pdf":
                raise ValueError(f"URL did not return a PDF: {pdf_url}")

            # Use arxiv ID as title
            title = f"arxiv:{arxiv_id}"

            logger.info(
                "Successfully downloaded arxiv PDF",
                arxiv_id=arxiv_id,
                size_bytes=len(response.content),
            )

            return response.content, title

    def extract_text_from_pdf(self, pdf_bytes: bytes) -> tuple[list[str], int]:
        """
        Extract text from PDF, returning list of page texts and total pages
        """
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pages = []

            for page_num in range(len(doc)):
                page = doc[page_num]
                text = page.get_text()
                pages.append(text)

            total_pages = len(doc)
            doc.close()

            return pages, total_pages

        except Exception as e:
            logger.error("Failed to extract text with PyMuPDF", error=str(e))
            # Fallback to pdfminer.six could be added here
            raise

    def count_tokens(self, text: str) -> int:
        """Count tokens in text"""
        return len(self.encoding.encode(text))

    def create_chunks(self, pages: list[str]) -> list[dict]:
        """
        Create overlapping chunks from pages
        Returns list of dicts with: page, chunk_index, text, token_count
        """
        chunks = []
        global_chunk_index = 0

        for page_num, page_text in enumerate(pages, start=1):
            if not page_text.strip():
                continue

            # Split page text into sentences (simple split)
            sentences = page_text.replace("\n", " ").split(". ")

            current_chunk = []
            current_tokens = 0

            for sentence in sentences:
                sentence = sentence.strip()
                if not sentence:
                    continue

                sentence_tokens = self.count_tokens(sentence)

                # If adding this sentence would exceed chunk size, save current chunk
                if current_tokens + sentence_tokens > self.chunk_size and current_chunk:
                    chunk_text = ". ".join(current_chunk) + "."
                    chunks.append(
                        {
                            "page": page_num,
                            "chunk_index": global_chunk_index,
                            "text": chunk_text,
                            "token_count": current_tokens,
                        }
                    )
                    global_chunk_index += 1

                    # Keep last few sentences for overlap
                    overlap_sentences = []
                    overlap_tokens = 0
                    for s in reversed(current_chunk):
                        s_tokens = self.count_tokens(s)
                        if overlap_tokens + s_tokens <= self.chunk_overlap:
                            overlap_sentences.insert(0, s)
                            overlap_tokens += s_tokens
                        else:
                            break

                    current_chunk = overlap_sentences
                    current_tokens = overlap_tokens

                current_chunk.append(sentence)
                current_tokens += sentence_tokens

            # Save remaining chunk for this page
            if current_chunk:
                chunk_text = ". ".join(current_chunk) + "."
                chunks.append(
                    {
                        "page": page_num,
                        "chunk_index": global_chunk_index,
                        "text": chunk_text,
                        "token_count": current_tokens,
                    }
                )
                global_chunk_index += 1

        logger.info(f"Created {len(chunks)} chunks from {len(pages)} pages")
        return chunks

    async def ingest_document(self, document_id: UUID, db: AsyncSession | None = None) -> bool:
        """
        Main ingestion function: download PDF, extract text, create chunks, generate embeddings

        If db is None, creates its own session (for background tasks).
        If db is provided, uses the provided session.
        """
        logger.info(
            "ingest_document called", document_id=str(document_id), db_provided=db is not None
        )

        # Create a new session if one wasn't provided (for background tasks)
        session_owner = db is None
        if session_owner:
            logger.info(
                "Creating new database session for background task", document_id=str(document_id)
            )
            async with AsyncSessionLocal() as db:
                try:
                    result = await self._ingest_document_internal(document_id, db)
                    logger.info("Ingestion completed", document_id=str(document_id), success=result)
                    return result
                except Exception as e:
                    logger.error(
                        "Error in ingestion with new session",
                        document_id=str(document_id),
                        error=str(e),
                        exc_info=e,
                    )
                    raise
        else:
            return await self._ingest_document_internal(document_id, db)

    async def _ingest_document_internal(self, document_id: UUID, db: AsyncSession) -> bool:
        """
        Internal ingestion implementation that works with an existing session
        """
        logger.info("_ingest_document_internal started", document_id=str(document_id))
        try:
            # Get document
            logger.info("Fetching document from database", document_id=str(document_id))
            result = await db.execute(select(Document).where(Document.id == document_id))
            document = result.scalar_one_or_none()

            if not document:
                logger.error("Document not found in database", document_id=str(document_id))
                return False

            logger.info(
                "Document found",
                document_id=str(document_id),
                status=document.status.value,
                path=document.storage_path,
            )

            # Update status to processing
            await db.execute(
                update(Document)
                .where(Document.id == document_id)
                .values(status=DocumentStatus.PROCESSING)
            )
            await db.commit()

            # Download PDF from storage
            logger.info("Downloading PDF", document_id=str(document_id), path=document.storage_path)
            try:
                pdf_bytes = await self.storage.download_file(document.storage_path)
                logger.info(
                    "PDF downloaded successfully",
                    document_id=str(document_id),
                    size_bytes=len(pdf_bytes),
                )
            except Exception as e:
                error_msg = f"Failed to download PDF from storage: {str(e)}"
                logger.error(error_msg, document_id=str(document_id), error=str(e), exc_info=e)
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
                return False

            # Extract text
            logger.info("Extracting text", document_id=str(document_id))
            try:
                pages, total_pages = self.extract_text_from_pdf(pdf_bytes)
                logger.info(
                    "Text extracted successfully",
                    document_id=str(document_id),
                    pages=total_pages,
                    total_text_length=sum(len(p) for p in pages),
                )
            except Exception as e:
                error_msg = f"Failed to extract text from PDF: {str(e)}"
                logger.error(error_msg, document_id=str(document_id), error=str(e), exc_info=e)
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
                return False

            # Create chunks
            logger.info("Creating chunks", document_id=str(document_id))
            try:
                chunks_data = self.create_chunks(pages)
                logger.info(
                    "Chunks created", document_id=str(document_id), chunk_count=len(chunks_data)
                )
            except Exception as e:
                error_msg = f"Failed to create chunks: {str(e)}"
                logger.error(error_msg, document_id=str(document_id), error=str(e), exc_info=e)
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
                return False

            if not chunks_data:
                error_msg = "No chunks created from PDF (possibly empty or unreadable PDF)"
                logger.warning(error_msg, document_id=str(document_id), pages=total_pages)
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR, pages=total_pages)
                )
                await db.commit()
                return False

            # Generate embeddings for all chunks
            logger.info(
                "Generating embeddings",
                document_id=str(document_id),
                chunk_count=len(chunks_data),
            )
            try:
                chunk_texts = [chunk["text"] for chunk in chunks_data]
                embeddings = await self.embedding.embed_batch(chunk_texts)
                logger.info(
                    "Embeddings generated",
                    document_id=str(document_id),
                    embedding_count=len(embeddings),
                )
            except Exception as e:
                error_msg = f"Failed to generate embeddings: {str(e)}"
                logger.error(error_msg, document_id=str(document_id), error=str(e), exc_info=e)
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
                return False

            if len(embeddings) != len(chunks_data):
                error_msg = (
                    f"Embedding count mismatch: expected {len(chunks_data)}, got {len(embeddings)}"
                )
                logger.error(error_msg, document_id=str(document_id))
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
                return False

            # Create chunk records
            logger.info("Saving chunks to database", document_id=str(document_id))
            try:
                chunk_records = []
                for chunk_data, embedding in zip(chunks_data, embeddings):
                    chunk = Chunk(
                        document_id=document_id,
                        page=chunk_data["page"],
                        chunk_index=chunk_data["chunk_index"],
                        text=chunk_data["text"],
                        embedding=embedding,
                        token_count=chunk_data["token_count"],
                    )
                    chunk_records.append(chunk)

                db.add_all(chunk_records)

                # Update document status to ready
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.READY, pages=total_pages)
                )

                await db.commit()

                logger.info(
                    "Document ingestion completed",
                    document_id=str(document_id),
                    chunks=len(chunk_records),
                    pages=total_pages,
                )

                return True
            except Exception as e:
                error_msg = f"Failed to save chunks to database: {str(e)}"
                logger.error(error_msg, document_id=str(document_id), error=str(e), exc_info=e)
                await db.rollback()
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
                return False

        except Exception as e:
            error_msg = f"Unexpected error during ingestion: {str(e)}"
            logger.error(error_msg, document_id=str(document_id), error=str(e), exc_info=e)

            # Update document status to error
            try:
                await db.rollback()
                await db.execute(
                    update(Document)
                    .where(Document.id == document_id)
                    .values(status=DocumentStatus.ERROR)
                )
                await db.commit()
            except Exception as db_error:
                logger.error(
                    "Failed to update document status to ERROR",
                    document_id=str(document_id),
                    error=str(db_error),
                )

            return False
