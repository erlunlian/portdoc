# isort: skip_file
import enum
from datetime import datetime
from uuid import UUID, uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from db.base import Base


class DocumentStatus(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class MessageRole(str, enum.Enum):
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class User(Base):
    """User table (profile mirror from Supabase Auth)"""

    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    documents: Mapped[list["Document"]] = relationship(
        back_populates="owner", cascade="all, delete"
    )
    threads: Mapped[list["Thread"]] = relationship(back_populates="user", cascade="all, delete")
    highlights: Mapped[list["Highlight"]] = relationship(
        back_populates="user", cascade="all, delete"
    )
    read_states: Mapped[list["DocumentReadState"]] = relationship(
        back_populates="user", cascade="all, delete"
    )


class Document(Base):
    """Document table"""

    __tablename__ = "documents"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    owner_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    original_filename: Mapped[str] = mapped_column(String(500), nullable=False)
    storage_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    pages: Mapped[int] = mapped_column(Integer, nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=True)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), default=DocumentStatus.UPLOADED, nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    owner: Mapped["User"] = relationship(back_populates="documents")
    chunks: Mapped[list["Chunk"]] = relationship(back_populates="document", cascade="all, delete")
    threads: Mapped[list["Thread"]] = relationship(back_populates="document", cascade="all, delete")
    highlights: Mapped[list["Highlight"]] = relationship(
        back_populates="document", cascade="all, delete"
    )
    read_states: Mapped[list["DocumentReadState"]] = relationship(
        back_populates="document", cascade="all, delete"
    )

    __table_args__ = (
        Index("ix_documents_owner_id", "owner_id"),
        Index("ix_documents_status", "status"),
    )


class DocumentReadState(Base):
    """Document read state per user"""

    __tablename__ = "document_read_states"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    last_page: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    scale: Mapped[float | None] = mapped_column(Float, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="read_states")
    document: Mapped["Document"] = relationship(back_populates="read_states")

    __table_args__ = (Index("ix_read_states_user_document", "user_id", "document_id", unique=True),)


class Highlight(Base):
    """Highlight table"""

    __tablename__ = "highlights"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    rects: Mapped[dict] = mapped_column(JSON, nullable=False)  # Array of {x, y, width, height}
    text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    user: Mapped["User"] = relationship(back_populates="highlights")
    document: Mapped["Document"] = relationship(back_populates="highlights")

    __table_args__ = (
        Index("ix_highlights_user_id", "user_id"),
        Index("ix_highlights_document_id", "document_id"),
    )


class Thread(Base):
    """Thread table for chat conversations"""

    __tablename__ = "threads"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship(back_populates="threads")
    document: Mapped["Document"] = relationship(back_populates="threads")
    messages: Mapped[list["Message"]] = relationship(back_populates="thread", cascade="all, delete")
    chat_runs: Mapped[list["ChatRun"]] = relationship(
        back_populates="thread", cascade="all, delete"
    )

    __table_args__ = (
        Index("ix_threads_user_id", "user_id"),
        Index("ix_threads_document_id", "document_id"),
    )


class Message(Base):
    """Message table for chat messages"""

    __tablename__ = "messages"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey("threads.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[MessageRole] = mapped_column(Enum(MessageRole), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    tokens_prompt: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tokens_completion: Mapped[int | None] = mapped_column(Integer, nullable=True)
    message_metadata: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True
    )  # For chunk_ids, pages, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    thread: Mapped["Thread"] = relationship(back_populates="messages")

    __table_args__ = (Index("ix_messages_thread_id", "thread_id"),)


class Chunk(Base):
    """Chunk table for document text chunks with embeddings"""

    __tablename__ = "chunks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
    )
    page: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # Ollama embeddings (1024-dimensional vectors)
    embedding: Mapped[Vector | None] = mapped_column(Vector(1024), nullable=True)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    document: Mapped["Document"] = relationship(back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_document_id", "document_id"),
        Index(
            "ix_chunks_embedding",
            "embedding",
            postgresql_using="ivfflat",
            postgresql_with={"lists": 100},
        ),
    )


class ChatRun(Base):
    """Chat run table for observability"""

    __tablename__ = "chat_runs"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    thread_id: Mapped[UUID] = mapped_column(
        ForeignKey("threads.id", ondelete="CASCADE"), nullable=False
    )
    provider: Mapped[str] = mapped_column(String(100), nullable=False)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    cost_usd: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    thread: Mapped["Thread"] = relationship(back_populates="chat_runs")

    __table_args__ = (Index("ix_chat_runs_thread_id", "thread_id"),)
