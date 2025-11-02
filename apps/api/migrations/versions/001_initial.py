"""initial

Revision ID: 001
Revises:
Create Date: 2025-01-01 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension (already created by Supabase postgres image)
    # No need to create it - it's already available
    pass

    # Create users table
    op.create_table(
        "users",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # Create documents table
    op.create_table(
        "documents",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("owner_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("original_filename", sa.String(length=500), nullable=False),
        sa.Column("storage_path", sa.String(length=1000), nullable=False),
        sa.Column("pages", sa.Integer(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("UPLOADED", "PROCESSING", "READY", "ERROR", name="documentstatus"),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_owner_id", "documents", ["owner_id"], unique=False)
    op.create_index("ix_documents_status", "documents", ["status"], unique=False)

    # Create document_read_states table
    op.create_table(
        "document_read_states",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("last_page", sa.Integer(), nullable=False),
        sa.Column("is_read", sa.Boolean(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_read_states_user_document",
        "document_read_states",
        ["user_id", "document_id"],
        unique=True,
    )

    # Create highlights table
    op.create_table(
        "highlights",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("rects", postgresql.JSON(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_highlights_document_id", "highlights", ["document_id"], unique=False)
    op.create_index("ix_highlights_user_id", "highlights", ["user_id"], unique=False)

    # Create threads table
    op.create_table(
        "threads",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_threads_document_id", "threads", ["document_id"], unique=False)
    op.create_index("ix_threads_user_id", "threads", ["user_id"], unique=False)

    # Create chunks table
    op.create_table(
        "chunks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("document_id", sa.UUID(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["documents.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"], unique=False)
    op.create_index(
        "ix_chunks_embedding", "chunks", ["embedding"], unique=False, postgresql_using="ivfflat"
    )

    # Create messages table
    op.create_table(
        "messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("thread_id", sa.UUID(), nullable=False),
        sa.Column(
            "role", sa.Enum("USER", "ASSISTANT", "SYSTEM", name="messagerole"), nullable=False
        ),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tokens_prompt", sa.Integer(), nullable=True),
        sa.Column("tokens_completion", sa.Integer(), nullable=True),
        sa.Column("metadata", postgresql.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_messages_thread_id", "messages", ["thread_id"], unique=False)

    # Create chat_runs table
    op.create_table(
        "chat_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("thread_id", sa.UUID(), nullable=False),
        sa.Column("provider", sa.String(length=100), nullable=False),
        sa.Column("model", sa.String(length=100), nullable=False),
        sa.Column("latency_ms", sa.Float(), nullable=False),
        sa.Column("cost_usd", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["thread_id"], ["threads.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_chat_runs_thread_id", "chat_runs", ["thread_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_chat_runs_thread_id", table_name="chat_runs")
    op.drop_table("chat_runs")
    op.drop_index("ix_messages_thread_id", table_name="messages")
    op.drop_table("messages")
    op.drop_index("ix_chunks_embedding", table_name="chunks", postgresql_using="ivfflat")
    op.drop_index("ix_chunks_document_id", table_name="chunks")
    op.drop_table("chunks")
    op.drop_index("ix_threads_user_id", table_name="threads")
    op.drop_index("ix_threads_document_id", table_name="threads")
    op.drop_table("threads")
    op.drop_index("ix_highlights_user_id", table_name="highlights")
    op.drop_index("ix_highlights_document_id", table_name="highlights")
    op.drop_table("highlights")
    op.drop_index("ix_read_states_user_document", table_name="document_read_states")
    op.drop_table("document_read_states")
    op.drop_index("ix_documents_status", table_name="documents")
    op.drop_index("ix_documents_owner_id", table_name="documents")
    op.drop_table("documents")
    op.drop_table("users")
    op.execute("DROP EXTENSION IF EXISTS vector")
    op.execute("DROP TYPE IF EXISTS documentstatus")
    op.execute("DROP TYPE IF EXISTS messagerole")
