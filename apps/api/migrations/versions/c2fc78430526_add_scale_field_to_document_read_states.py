"""Add scale field to document_read_states

Revision ID: c2fc78430526
Revises: 001
Create Date: 2025-11-02 10:48:05.385020

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c2fc78430526'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add scale column to document_read_states table
    op.add_column('document_read_states', sa.Column('scale', sa.Float(), nullable=True))


def downgrade() -> None:
    # Remove scale column from document_read_states table
    op.drop_column('document_read_states', 'scale')

