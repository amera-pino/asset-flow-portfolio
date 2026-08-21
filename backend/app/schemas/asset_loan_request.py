from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.constants.enums import AssetLoanRequestStatus


# 備品貸出申請画面から受け取る POST /api/requests の入力スキーマ
class AssetLoanRequestCreate(BaseModel):
    asset_id: int = Field(ge=1)
    requester_name: str = Field(min_length=1, max_length=120)
    start_date: date
    end_date: date
    reason: str = Field(min_length=1, max_length=300)
    quantity: int = Field(ge=1)

    # 申請期間が逆転していないことを API 入力時点で検証する
    @model_validator(mode="after")
    def validate_date_range(self) -> "AssetLoanRequestCreate":
        if self.end_date < self.start_date:
            raise ValueError("終了日は開始日以降の日付を指定してください。")
        return self


# 申請作成・返却・取消 API で返す貸出申請レスポンス
class AssetLoanRequestRead(BaseModel):
    id: int
    asset_id: int
    user_id: int
    requester_name: str
    start_date: date
    end_date: date
    reason: str
    quantity: int
    status: AssetLoanRequestStatus
    returned_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# マイ貸出状況画面向けに備品名・カテゴリを足したレスポンス
class ActiveAssetLoanRequestRead(AssetLoanRequestRead):
    asset_name: str
    asset_category: str
