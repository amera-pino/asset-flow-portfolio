"""add department to users

Revision ID: 20260810_0003
Revises: 20260801_0002
Create Date: 2026-08-10 09:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260810_0003"
down_revision = "20260801_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("department", sa.String(length=120), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "department")
