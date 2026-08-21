from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.constants.enums import AssetStatus


# 備品 API で共通して使う基本項目
class AssetBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    category: str = Field(min_length=1, max_length=80)
    status: AssetStatus = Field(default=AssetStatus.available)


# 備品登録 API 用の入力スキーマ
class AssetCreate(AssetBase):
    total_stock: int = Field(ge=1)


# 備品一覧の1行に相当する備品レスポンス
class AssetRow(AssetBase):
    id: int
    total_stock: int = Field(ge=0)
    consuming_quantity: int = Field(ge=0)
    effective_stock: int = Field(ge=0)
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# AssetRow の一覧とページ情報をまとめたレスポンス
class AssetPage(BaseModel):
    items: list[AssetRow]
    filtered_item_count: int = Field(ge=0)
    total_item_count: int = Field(ge=0)
    total_item_stock: int = Field(ge=0)
    total_effective_stock: int = Field(ge=0)
    low_stock_item_count: int = Field(ge=0)
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total_pages: int = Field(ge=1)
