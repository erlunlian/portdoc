"""Add note field to highlights

Revision ID: 004
Revises: 003_fix_embedding_dimensions, c2fc78430526
Create Date: 2025-11-13 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "004"
down_revision = ("003_fix_embedding_dimensions", "c2fc78430526")
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add note column to highlights table
    op.add_column("highlights", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove note column from highlights table
    op.drop_column("highlights", "note")
