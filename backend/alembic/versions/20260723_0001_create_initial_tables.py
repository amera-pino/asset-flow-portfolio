"""create initial tables

Revision ID: 20260723_0001
Revises:
Create Date: 2026-07-23 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260723_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "assets",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("current_stock", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("current_stock >= 0", name="ck_assets_current_stock_non_negative"),
        sa.CheckConstraint("length(name) > 0", name="ck_assets_name_not_empty"),
        sa.CheckConstraint("length(category) > 0", name="ck_assets_category_not_empty"),
    )
    op.create_index("ix_assets_id", "assets", ["id"], unique=False)
    op.create_index("ix_assets_name", "assets", ["name"], unique=False)

    op.create_table(
        "asset_loan_requests",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("asset_id", sa.Integer(), nullable=False),
        sa.Column("requester_name", sa.String(length=120), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["asset_id"], ["assets.id"], ondelete="RESTRICT"),
        sa.CheckConstraint("quantity >= 1", name="ck_asset_loan_requests_quantity_positive"),
        sa.CheckConstraint("end_date >= start_date", name="ck_asset_loan_requests_date_range"),
        sa.CheckConstraint("length(requester_name) > 0", name="ck_asset_loan_requests_requester_name_not_empty"),
        sa.CheckConstraint("length(reason) > 0", name="ck_asset_loan_requests_reason_not_empty"),
        sa.CheckConstraint("length(reason) <= 300", name="ck_asset_loan_requests_reason_max_length"),
    )
    op.create_index("ix_asset_loan_requests_id", "asset_loan_requests", ["id"], unique=False)
    op.create_index("ix_asset_loan_requests_asset_id", "asset_loan_requests", ["asset_id"], unique=False)
    op.create_index("ix_asset_loan_requests_user_id", "asset_loan_requests", ["user_id"], unique=False)
    op.create_index("ix_asset_loan_requests_asset_id_status", "asset_loan_requests", ["asset_id", "status"], unique=False)
    op.create_index("ix_asset_loan_requests_user_id_status", "asset_loan_requests", ["user_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_asset_loan_requests_user_id_status", table_name="asset_loan_requests")
    op.drop_index("ix_asset_loan_requests_asset_id_status", table_name="asset_loan_requests")
    op.drop_index("ix_asset_loan_requests_user_id", table_name="asset_loan_requests")
    op.drop_index("ix_asset_loan_requests_asset_id", table_name="asset_loan_requests")
    op.drop_index("ix_asset_loan_requests_id", table_name="asset_loan_requests")
    op.drop_table("asset_loan_requests")

    op.drop_index("ix_assets_name", table_name="assets")
    op.drop_index("ix_assets_id", table_name="assets")
    op.drop_table("assets")
