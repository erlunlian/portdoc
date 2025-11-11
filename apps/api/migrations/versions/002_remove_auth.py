"""Remove authentication and user tables

Revision ID: 002_remove_auth
Revises: c2fc78430526
Create Date: 2025-11-11

"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "002_remove_auth"
down_revision = "c2fc78430526"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop foreign key constraints and columns from threads
    op.drop_index("ix_threads_user_id", table_name="threads")
    op.drop_constraint("threads_user_id_fkey", "threads", type_="foreignkey")
    op.drop_column("threads", "user_id")

    # Drop foreign key constraints and columns from highlights
    op.drop_index("ix_highlights_user_id", table_name="highlights")
    op.drop_constraint("highlights_user_id_fkey", "highlights", type_="foreignkey")
    op.drop_column("highlights", "user_id")

    # Drop foreign key constraints and columns from document_read_states
    op.drop_index("ix_read_states_user_document", table_name="document_read_states")
    op.drop_constraint(
        "document_read_states_user_id_fkey", "document_read_states", type_="foreignkey"
    )
    op.drop_column("document_read_states", "user_id")

    # Add unique constraint on document_id for read states (single user)
    op.create_index("ix_read_states_document", "document_read_states", ["document_id"], unique=True)

    # Drop foreign key constraints and columns from documents
    op.drop_index("ix_documents_owner_id", table_name="documents")
    op.drop_constraint("documents_owner_id_fkey", "documents", type_="foreignkey")
    op.drop_column("documents", "owner_id")

    # Drop users table
    op.drop_table("users")


def downgrade() -> None:
    # Recreate users table
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # Add owner_id back to documents
    op.add_column("documents", sa.Column("owner_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "documents_owner_id_fkey", "documents", "users", ["owner_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_documents_owner_id", "documents", ["owner_id"])

    # Add user_id back to document_read_states
    op.drop_index("ix_read_states_document", table_name="document_read_states")
    op.add_column(
        "document_read_states", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.create_foreign_key(
        "document_read_states_user_id_fkey",
        "document_read_states",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_read_states_user_document",
        "document_read_states",
        ["user_id", "document_id"],
        unique=True,
    )

    # Add user_id back to highlights
    op.add_column("highlights", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "highlights_user_id_fkey", "highlights", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_highlights_user_id", "highlights", ["user_id"])

    # Add user_id back to threads
    op.add_column("threads", sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key(
        "threads_user_id_fkey", "threads", "users", ["user_id"], ["id"], ondelete="CASCADE"
    )
    op.create_index("ix_threads_user_id", "threads", ["user_id"])
