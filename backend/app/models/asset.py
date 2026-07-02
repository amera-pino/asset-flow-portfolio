from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.asset_request import AssetRequest


# assets テーブルを表す DB モデルで、備品一覧・申請画面の元データ
class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        CheckConstraint("current_stock >= 0", name="ck_assets_current_stock_non_negative"),
        CheckConstraint("length(name) > 0", name="ck_assets_name_not_empty"),
        CheckConstraint("length(category) > 0", name="ck_assets_category_not_empty"),
        Index("ix_assets_name", "name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    total_stock: Mapped[int] = mapped_column("current_stock", Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="available")
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

    requests: Mapped[list["AssetRequest"]] = relationship(
        "AssetRequest",
        back_populates="asset",
        cascade="all, delete-orphan",
    )
