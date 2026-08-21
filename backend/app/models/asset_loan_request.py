from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants.enums import AssetLoanRequestStatus
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asset import Asset


# asset_loan_requests テーブルを表す DB モデルで、申請・返却・取消の状態を保持する
class AssetLoanRequest(Base):
    __tablename__ = "asset_loan_requests"
    __table_args__ = (
        CheckConstraint("quantity >= 1", name="ck_asset_loan_requests_quantity_positive"),
        CheckConstraint("end_date >= start_date", name="ck_asset_loan_requests_date_range"),
        CheckConstraint("length(requester_name) > 0", name="ck_asset_loan_requests_requester_name_not_empty"),
        CheckConstraint("length(reason) > 0", name="ck_asset_loan_requests_reason_not_empty"),
        CheckConstraint("length(reason) <= 300", name="ck_asset_loan_requests_reason_max_length"),
        Index("ix_asset_loan_requests_asset_id_status", "asset_id", "status"),
        Index("ix_asset_loan_requests_user_id_status", "user_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    asset_id: Mapped[int] = mapped_column(
        ForeignKey("assets.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    requester_name: Mapped[str] = mapped_column(String(120), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1, index=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[AssetLoanRequestStatus] = mapped_column(
        String(40),
        nullable=False,
        default=AssetLoanRequestStatus.pending,
    )
    returned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    asset: Mapped["Asset"] = relationship("Asset", back_populates="loan_requests")
