from typing import Any, Generic, TypeVar

from pydantic import BaseModel


DataT = TypeVar("DataT")


# フロントの API エラー表示に渡す共通エラー情報
class ApiError(BaseModel):
    code: str
    message: str
    details: Any | None = None


# すべての API が返す success/data/error の共通ラッパー
class ApiResponse(BaseModel, Generic[DataT]):
    success: bool
    data: DataT | None = None
    error: ApiError | None = None


# route 層から成功時の共通レスポンス辞書を作る
def success_response(data: object) -> dict[str, Any]:
    return {"success": True, "data": data, "error": None}


# route 層・例外ハンドラから失敗時の共通レスポンス辞書を作る
def error_response(code: str, message: str, details: Any | None = None) -> dict[str, Any]:
    return {
        "success": False,
        "data": None,
        "error": {"code": code, "message": message, "details": details},
    }
