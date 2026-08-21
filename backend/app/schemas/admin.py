from typing import Literal

from pydantic import BaseModel, Field


class AdminSummary(BaseModel):
    pending_request_count: int = Field(ge=0)
    approved_request_count: int = Field(ge=0)
    rejected_request_count: int = Field(ge=0)
    loaned_request_count: int = Field(ge=0)
    registered_asset_count: int = Field(ge=0)
    managed_user_count: int = Field(ge=0)


class AdminUserRead(BaseModel):
    id: int
    name: str
    login_id: str
    role: Literal["admin", "user"]
    department: str | None
    state: Literal["active"]


class AdminUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    login_id: str = Field(min_length=1, max_length=120)
    role: Literal["admin", "user"] = "user"
    department: str | None = Field(default=None, max_length=120)
