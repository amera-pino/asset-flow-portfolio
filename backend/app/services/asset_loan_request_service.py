from http import HTTPStatus
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants.enums import AssetLoanRequestStatus
from app.constants.error_messages import (
    ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND,
    ERROR_409_LOAN_REQUEST_CONFLICT,
)
from app.models.asset import Asset
from app.models.asset_loan_request import AssetLoanRequest
from app.schemas.asset_loan_request import AssetLoanRequestCreate


# route 層で HTTP エラーへ変換する業務エラーの基底
class AssetLoanRequestError(Exception):
    code = "ASSET_LOAN_REQUEST_ERROR"
    status_code = HTTPStatus.BAD_REQUEST

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


# 申請対象の備品が存在しない場合の業務エラー
class AssetNotFoundError(AssetLoanRequestError):
    code = "ASSET_NOT_FOUND"
    status_code = HTTPStatus.NOT_FOUND


# 有効在庫不足で申請できない場合の業務エラー
class InsufficientReservedStockError(AssetLoanRequestError):
    code = "INSUFFICIENT_STOCK"
    status_code = HTTPStatus.CONFLICT


# 返却・取消対象の申請が見つからない場合の業務エラー
class ActiveAssetLoanRequestNotFoundError(AssetLoanRequestError):
    code = "ACTIVE_REQUEST_NOT_FOUND"
    status_code = HTTPStatus.NOT_FOUND


# 貸出中以外を返却しようとした場合の業務エラー
class AssetLoanRequestReturnError(AssetLoanRequestError):
    code = "ASSET_LOAN_REQUEST_NOT_RETURNABLE"
    status_code = HTTPStatus.CONFLICT


# 承認待ち以外をキャンセルしようとした場合の業務エラー
class AssetLoanRequestCancelError(AssetLoanRequestError):
    code = "ASSET_LOAN_REQUEST_NOT_CANCELABLE"
    status_code = HTTPStatus.CONFLICT


# 承認待ち以外を承認しようとした場合の業務エラー
class AssetLoanRequestApproveError(AssetLoanRequestError):
    code = "ASSET_LOAN_REQUEST_NOT_APPROVABLE"
    status_code = HTTPStatus.CONFLICT


# 承認待ち・承認済み以外を承認却下しようとした場合の業務エラー
class AssetLoanRequestRejectError(AssetLoanRequestError):
    code = "ASSET_LOAN_REQUEST_NOT_REJECTABLE"
    status_code = HTTPStatus.CONFLICT


# 承認済み以外を貸出開始しようとした場合の業務エラー
class AssetLoanRequestStartLoanError(AssetLoanRequestError):
    code = "ASSET_LOAN_REQUEST_NOT_STARTABLE"
    status_code = HTTPStatus.CONFLICT


# 在庫をロックして消費中数量を確認し、承認待ち申請を作成する業務処理
def create_asset_loan_request(
    db: Session,
    payload: AssetLoanRequestCreate,
    user_id: int,
) -> AssetLoanRequest:
    asset = db.scalar(
        select(Asset)
        .where(Asset.id == payload.asset_id)
        .with_for_update()
    )

    if asset is None:
        raise AssetNotFoundError(ERROR_404_LOAN_REQUEST_ASSET_NOT_FOUND)

    consuming_quantity = db.scalar(
        select(func.coalesce(func.sum(AssetLoanRequest.quantity), 0)).where(
            AssetLoanRequest.asset_id == payload.asset_id,
                AssetLoanRequest.status.in_(
                [
                    AssetLoanRequestStatus.pending,
                    AssetLoanRequestStatus.approved,
                    AssetLoanRequestStatus.loaned,
                ]
            ),
        )
    )
    available_quantity = asset.total_stock - int(consuming_quantity or 0)

    if available_quantity < payload.quantity:
        raise InsufficientReservedStockError(ERROR_409_LOAN_REQUEST_CONFLICT)

    asset_loan_request = AssetLoanRequest(
        asset_id=payload.asset_id,
        user_id=user_id,
        requester_name=payload.requester_name,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        quantity=payload.quantity,
        status=AssetLoanRequestStatus.pending,
    )
    db.add(asset_loan_request)
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request


# マイ貸出状況に出す承認待ち・貸出中申請を備品情報付きで取得する
def list_active_asset_loan_requests(db: Session, user_id: int = 1) -> list[tuple[AssetLoanRequest, Asset]]:
    return list(
        db.execute(
            select(AssetLoanRequest, Asset)
            .join(Asset, Asset.id == AssetLoanRequest.asset_id)
            .where(
                AssetLoanRequest.user_id == user_id,
                AssetLoanRequest.status.in_(
                    [
                        AssetLoanRequestStatus.loaned,
                        AssetLoanRequestStatus.approved,
                        AssetLoanRequestStatus.rejected,
                        AssetLoanRequestStatus.pending,
                    ]
                ),
            )
            .order_by(AssetLoanRequest.end_date.asc(), AssetLoanRequest.id.asc())
        ).all()
    )


# 管理者向けに全ユーザー分の承認待ち・貸出中申請を備品情報付きで取得する
def list_admin_active_asset_loan_requests(db: Session) -> list[tuple[AssetLoanRequest, Asset]]:
    return list(
        db.execute(
            select(AssetLoanRequest, Asset)
            .join(Asset, Asset.id == AssetLoanRequest.asset_id)
            .where(
                AssetLoanRequest.status.in_(
                    [
                        AssetLoanRequestStatus.loaned,
                        AssetLoanRequestStatus.approved,
                        AssetLoanRequestStatus.rejected,
                        AssetLoanRequestStatus.pending,
                    ]
                ),
            )
            .order_by(AssetLoanRequest.end_date.asc(), AssetLoanRequest.id.asc())
        ).all()
    )


# 貸出中申請だけを返却済みに状態遷移させる業務処理
def return_asset_loan_request(db: Session, request_id: int, user_id: int = 1) -> AssetLoanRequest:
    asset_loan_request = db.scalar(
        select(AssetLoanRequest)
        .where(
            AssetLoanRequest.id == request_id,
            AssetLoanRequest.user_id == user_id,
        )
        .with_for_update()
    )

    if asset_loan_request is None:
        raise ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。")

    if asset_loan_request.status != AssetLoanRequestStatus.loaned:
        raise AssetLoanRequestReturnError("貸出中の備品のみ返却できます。")

    asset_loan_request.status = AssetLoanRequestStatus.returned
    asset_loan_request.returned_at = datetime.now(UTC)
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request


# 管理者が承認待ち申請を貸出中へ状態遷移させる業務処理
def approve_asset_loan_request(db: Session, request_id: int) -> AssetLoanRequest:
    asset_loan_request = db.scalar(
        select(AssetLoanRequest)
        .where(AssetLoanRequest.id == request_id)
        .with_for_update()
    )

    if asset_loan_request is None:
        raise ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。")

    if asset_loan_request.status != AssetLoanRequestStatus.pending:
        raise AssetLoanRequestApproveError("承認待ちの申請のみ承認できます。")

    asset_loan_request.status = AssetLoanRequestStatus.approved
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request


# 一般ユーザーが承認済み申請を貸出中へ状態遷移させる業務処理
def start_approved_asset_loan_request(db: Session, request_id: int, user_id: int = 1) -> AssetLoanRequest:
    asset_loan_request = db.scalar(
        select(AssetLoanRequest)
        .where(
            AssetLoanRequest.id == request_id,
            AssetLoanRequest.user_id == user_id,
        )
        .with_for_update()
    )

    if asset_loan_request is None:
        raise ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。")

    if asset_loan_request.status != AssetLoanRequestStatus.approved:
        raise AssetLoanRequestStartLoanError("承認済みの申請のみ貸出開始できます。")

    asset_loan_request.status = AssetLoanRequestStatus.loaned
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request


# 承認待ち・承認却下申請をキャンセル済みに状態遷移させる業務処理
def cancel_asset_loan_request(db: Session, request_id: int, user_id: int = 1) -> AssetLoanRequest:
    asset_loan_request = db.scalar(
        select(AssetLoanRequest)
        .where(
            AssetLoanRequest.id == request_id,
            AssetLoanRequest.user_id == user_id,
        )
        .with_for_update()
    )

    if asset_loan_request is None:
        raise ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。")

    if asset_loan_request.status not in {
        AssetLoanRequestStatus.pending,
        AssetLoanRequestStatus.rejected,
    }:
        raise AssetLoanRequestCancelError("承認待ちまたは承認却下の申請のみキャンセルできます。")

    asset_loan_request.status = AssetLoanRequestStatus.cancelled
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request


# 管理者が承認待ち・承認済み申請を承認却下へ状態遷移させる業務処理
def reject_asset_loan_request(db: Session, request_id: int) -> AssetLoanRequest:
    asset_loan_request = db.scalar(
        select(AssetLoanRequest)
        .where(AssetLoanRequest.id == request_id)
        .with_for_update()
    )

    if asset_loan_request is None:
        raise ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。")

    if asset_loan_request.status not in {
        AssetLoanRequestStatus.pending,
        AssetLoanRequestStatus.approved,
    }:
        raise AssetLoanRequestRejectError("承認待ちまたは承認済みの申請のみ承認却下できます。")

    asset_loan_request.status = AssetLoanRequestStatus.rejected
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request


# 管理者が貸出中申請を強制返却済みに状態遷移させる業務処理
def force_return_asset_loan_request(db: Session, request_id: int) -> AssetLoanRequest:
    asset_loan_request = db.scalar(
        select(AssetLoanRequest)
        .where(AssetLoanRequest.id == request_id)
        .with_for_update()
    )

    if asset_loan_request is None:
        raise ActiveAssetLoanRequestNotFoundError("対象の貸出申請が見つかりません。")

    if asset_loan_request.status != AssetLoanRequestStatus.loaned:
        raise AssetLoanRequestReturnError("貸出中の備品のみ強制返却できます。")

    asset_loan_request.status = AssetLoanRequestStatus.returned
    asset_loan_request.returned_at = datetime.now(UTC)
    db.commit()
    db.refresh(asset_loan_request)

    return asset_loan_request
