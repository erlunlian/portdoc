"""Fix embedding dimensions for mxbai-embed-large

Revision ID: 003_fix_embedding_dimensions
Revises: 002_remove_auth
Create Date: 2025-11-11

"""

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision = "003_fix_embedding_dimensions"
down_revision = "002_remove_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the existing index on embeddings
    op.drop_index("ix_chunks_embedding", table_name="chunks")
    
    # Change the embedding column from vector(1536) to vector(1024)
    op.execute("ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1024)")
    
    # Recreate the index with the new dimensions
    op.execute(
        "CREATE INDEX ix_chunks_embedding ON chunks USING ivfflat (embedding) WITH (lists = 100)"
    )


def downgrade() -> None:
    # Drop the index
    op.drop_index("ix_chunks_embedding", table_name="chunks")
    
    # Change back to vector(1536)
    op.execute("ALTER TABLE chunks ALTER COLUMN embedding TYPE vector(1536)")
    
    # Recreate the index
    op.execute(
        "CREATE INDEX ix_chunks_embedding ON chunks USING ivfflat (embedding) WITH (lists = 100)"
    )

