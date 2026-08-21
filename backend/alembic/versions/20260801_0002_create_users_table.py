"""create users table

Revision ID: 20260801_0002
Revises: 20260723_0001
Create Date: 2026-08-01 11:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260801_0002"
down_revision = "20260723_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("login_id", sa.String(length=120), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("length(name) > 0", name="ck_users_name_not_empty"),
        sa.CheckConstraint("length(login_id) > 0", name="ck_users_login_id_not_empty"),
        sa.CheckConstraint("length(password_hash) > 0", name="ck_users_password_hash_not_empty"),
        sa.CheckConstraint("role in ('admin', 'user')", name="ck_users_role_supported"),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_login_id", "users", ["login_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_login_id", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
