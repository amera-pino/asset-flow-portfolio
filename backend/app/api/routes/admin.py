from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.constants.enums import AssetLoanRequestStatus
from app.constants.error_messages import (
    ERROR_500_ADMIN_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_500_ADMIN_REQUEST_APPROVE_FAILED,
    ERROR_500_ADMIN_REQUEST_FORCE_RETURN_FAILED,
    ERROR_500_ADMIN_REQUEST_REJECT_FAILED,
    ERROR_500_ADMIN_SUMMARY_FETCH_FAILED,
)
from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.security import hash_password
from app.models.asset import Asset
from app.models.asset_loan_request import AssetLoanRequest
from app.models.user import User
from app.schemas.admin import AdminSummary, AdminUserCreate, AdminUserRead
from app.schemas.asset_loan_request import ActiveAssetLoanRequestRead, AssetLoanRequestRead
from app.schemas.response import ApiResponse, error_response, success_response
from app.services.asset_loan_request_service import (
    AssetLoanRequestError,
    approve_asset_loan_request,
    force_return_asset_loan_request,
    list_admin_active_asset_loan_requests,
    reject_asset_loan_request,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def serialize_admin_user(user: User) -> AdminUserRead:
    return AdminUserRead(
        id=user.id,
        name=user.name,
        login_id=user.login_id,
        role=user.role,
        department=user.department,
        state="active",
    )


@router.get("/summary", response_model=ApiResponse[AdminSummary])
def get_admin_summary(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    try:
        pending_request_count = (
            db.scalar(
                select(func.count())
                .select_from(AssetLoanRequest)
                .where(AssetLoanRequest.status == AssetLoanRequestStatus.pending)
            )
            or 0
        )
        approved_request_count = (
            db.scalar(
                select(func.count())
                .select_from(AssetLoanRequest)
                .where(AssetLoanRequest.status == AssetLoanRequestStatus.approved)
            )
            or 0
        )
        rejected_request_count = (
            db.scalar(
                select(func.count())
                .select_from(AssetLoanRequest)
                .where(AssetLoanRequest.status == AssetLoanRequestStatus.rejected)
            )
            or 0
        )
        loaned_request_count = (
            db.scalar(
                select(func.count())
                .select_from(AssetLoanRequest)
                .where(AssetLoanRequest.status == AssetLoanRequestStatus.loaned)
            )
            or 0
        )
        registered_asset_count = db.scalar(select(func.count()).select_from(Asset)) or 0
        managed_user_count = db.scalar(select(func.count()).select_from(User)) or 0
    except SQLAlchemyError:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ADMIN_SUMMARY_FETCH_FAILED",
                ERROR_500_ADMIN_SUMMARY_FETCH_FAILED,
            ),
        )

    return success_response(
        AdminSummary(
            pending_request_count=pending_request_count,
            approved_request_count=approved_request_count,
            rejected_request_count=rejected_request_count,
            loaned_request_count=loaned_request_count,
            registered_asset_count=registered_asset_count,
            managed_user_count=managed_user_count,
        )
    )


@router.get("/users", response_model=ApiResponse[list[AdminUserRead]])
def list_admin_users(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    users = db.scalars(select(User).order_by(User.id.asc())).all()
    return success_response([serialize_admin_user(user) for user in users])


@router.post("/users", response_model=ApiResponse[AdminUserRead])
def create_admin_user(
    payload: AdminUserCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    user = User(
        name=payload.name.strip(),
        login_id=payload.login_id.strip().lower(),
        password_hash=hash_password("AssetFlow2026!"),
        role=payload.role,
        department=(payload.department or "").strip() or None,
    )

    db.add(user)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return JSONResponse(
            status_code=HTTPStatus.CONFLICT,
            content=error_response(
                "ADMIN_USER_LOGIN_ID_CONFLICT",
                "同じログインIDのユーザーがすでに存在します。",
            ),
        )

    db.refresh(user)
    return success_response(serialize_admin_user(user))


@router.delete("/users/{user_id}", response_model=ApiResponse[dict[str, int]])
def delete_admin_user(
    user_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    if current_user.id == user_id:
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="ログイン中の管理者ユーザーは削除できません。",
        )

    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=HTTPStatus.NOT_FOUND,
            detail="対象ユーザーが見つかりません。",
        )

    if user.role == "admin":
        raise HTTPException(
            status_code=HTTPStatus.BAD_REQUEST,
            detail="管理者ユーザーは削除できません。",
        )

    db.delete(user)
    db.commit()
    return success_response({"deleted_user_id": user_id})


@router.get("/requests/active", response_model=ApiResponse[list[ActiveAssetLoanRequestRead]])
def list_admin_active_requests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    try:
        active_request_rows = list_admin_active_asset_loan_requests(db)
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ADMIN_ACTIVE_REQUESTS_FETCH_FAILED",
                ERROR_500_ADMIN_ACTIVE_REQUESTS_FETCH_FAILED,
            ),
        )

    user_ids = list({asset_loan_request.user_id for asset_loan_request, _ in active_request_rows})
    user_name_by_id = {
        user.id: user.name
        for user in db.scalars(select(User).where(User.id.in_(user_ids))).all()
    }

    active_requests = [
        ActiveAssetLoanRequestRead(
            **{
                **AssetLoanRequestRead.model_validate(asset_loan_request).model_dump(),
                "requester_name": user_name_by_id.get(
                    asset_loan_request.user_id,
                    asset_loan_request.requester_name,
                ),
            },
            asset_name=asset.name,
            asset_category=asset.category,
        )
        for asset_loan_request, asset in active_request_rows
    ]

    return success_response(active_requests)


@router.post("/requests/{request_id}/approve", response_model=ApiResponse[AssetLoanRequestRead])
def approve_admin_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    try:
        asset_loan_request = approve_asset_loan_request(db, request_id)
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ADMIN_REQUEST_APPROVE_FAILED",
                ERROR_500_ADMIN_REQUEST_APPROVE_FAILED,
            ),
        )

    return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))


@router.post("/requests/{request_id}/reject", response_model=ApiResponse[AssetLoanRequestRead])
def reject_admin_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    try:
        asset_loan_request = reject_asset_loan_request(db, request_id)
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ADMIN_REQUEST_REJECT_FAILED",
                ERROR_500_ADMIN_REQUEST_REJECT_FAILED,
            ),
        )

    return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))


@router.post("/requests/{request_id}/force-return", response_model=ApiResponse[AssetLoanRequestRead])
def force_return_admin_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=HTTPStatus.FORBIDDEN,
            detail="管理者権限が必要です。",
        )

    try:
        asset_loan_request = force_return_asset_loan_request(db, request_id)
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ADMIN_REQUEST_FORCE_RETURN_FAILED",
                ERROR_500_ADMIN_REQUEST_FORCE_RETURN_FAILED,
            ),
        )

    return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))
