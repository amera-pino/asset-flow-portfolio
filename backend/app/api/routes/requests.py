from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.constants.error_messages import (
    ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_500_CANCEL_REQUEST_FAILED,
    ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
    ERROR_500_RETURN_REQUEST_FAILED,
    ERROR_500_START_LOAN_REQUEST_FAILED,
    ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_503_CANCEL_REQUEST_FAILED,
    ERROR_503_RETURN_REQUEST_FAILED,
    ERROR_503_START_LOAN_REQUEST_FAILED,
    ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED,
    ERROR_504_CANCEL_REQUEST_FAILED,
    ERROR_504_RETURN_REQUEST_FAILED,
    ERROR_504_START_LOAN_REQUEST_FAILED,
)
from app.core.auth import get_current_user
from app.core.exceptions import (
    ContextualInternalServerError,
    GatewayTimeoutError,
    ServiceUnavailableError,
)
from app.core.database import get_db
from app.models.user import User
from app.schemas.asset_loan_request import ActiveAssetLoanRequestRead, AssetLoanRequestCreate, AssetLoanRequestRead
from app.schemas.response import ApiResponse, error_response, success_response
from app.services.asset_loan_request_service import (
    AssetLoanRequestError,
    cancel_asset_loan_request,
    create_asset_loan_request,
    list_active_asset_loan_requests,
    return_asset_loan_request,
    start_approved_asset_loan_request,
)

router = APIRouter(prefix="/requests", tags=["requests"])


# 備品貸出申請画面からの POST を受け、service 層で在庫判定して申請を作る
@router.post("", response_model=ApiResponse[AssetLoanRequestRead], status_code=HTTPStatus.CREATED)
def create_request(
    payload: AssetLoanRequestCreate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        asset_loan_request = create_asset_loan_request(db, payload, current_user.id)
        return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except Exception as exc:
        raise ContextualInternalServerError(
            "LOAN_REQUEST_SUBMIT_FAILED",
            ERROR_500_LOAN_REQUEST_SUBMIT_FAILED,
        ) from exc


# マイ貸出状況画面へ承認待ち・貸出中の申請を返す
@router.get("/me/active", response_model=ApiResponse[list[ActiveAssetLoanRequestRead]])
def list_my_active_requests(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    try:
        active_request_rows = list_active_asset_loan_requests(db, current_user.id)
    except TimeoutError as exc:
        raise GatewayTimeoutError(ERROR_504_ACTIVE_REQUESTS_FETCH_FAILED) from exc
    except ConnectionError as exc:
        raise ServiceUnavailableError(ERROR_503_ACTIVE_REQUESTS_FETCH_FAILED) from exc
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "ACTIVE_REQUESTS_FETCH_FAILED",
                ERROR_500_ACTIVE_REQUESTS_FETCH_FAILED,
            ),
        )

    active_requests = [
        ActiveAssetLoanRequestRead(
            **AssetLoanRequestRead.model_validate(asset_loan_request).model_dump(),
            asset_name=asset.name,
            asset_category=asset.category,
        )
        for asset_loan_request, asset in active_request_rows
    ]

    return success_response(active_requests)


# 返却ボタンからの POST を受け、service 層で返却状態へ遷移する
@router.post("/{request_id}/return", response_model=ApiResponse[AssetLoanRequestRead])
def return_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        asset_loan_request = return_asset_loan_request(db, request_id, current_user.id)
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except TimeoutError as exc:
        raise GatewayTimeoutError(ERROR_504_RETURN_REQUEST_FAILED) from exc
    except ConnectionError as exc:
        raise ServiceUnavailableError(ERROR_503_RETURN_REQUEST_FAILED) from exc
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "RETURN_REQUEST_FAILED",
                ERROR_500_RETURN_REQUEST_FAILED,
            ),
        )

    return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))


# 貸出開始ボタンからの POST を受け、承認済み申請を貸出中へ遷移する
@router.post("/{request_id}/start-loan", response_model=ApiResponse[AssetLoanRequestRead])
def start_loan_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        asset_loan_request = start_approved_asset_loan_request(db, request_id, current_user.id)
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except TimeoutError as exc:
        raise GatewayTimeoutError(ERROR_504_START_LOAN_REQUEST_FAILED) from exc
    except ConnectionError as exc:
        raise ServiceUnavailableError(ERROR_503_START_LOAN_REQUEST_FAILED) from exc
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "START_LOAN_REQUEST_FAILED",
                ERROR_500_START_LOAN_REQUEST_FAILED,
            ),
        )

    return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))


# キャンセルボタンからの POST を受け、service 層で承認待ち申請を取り消す
@router.post("/{request_id}/cancel", response_model=ApiResponse[AssetLoanRequestRead])
def cancel_request(
    request_id: int,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict | JSONResponse:
    try:
        asset_loan_request = cancel_asset_loan_request(db, request_id, current_user.id)
    except AssetLoanRequestError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_response(exc.code, exc.message),
        )
    except TimeoutError as exc:
        raise GatewayTimeoutError(ERROR_504_CANCEL_REQUEST_FAILED) from exc
    except ConnectionError as exc:
        raise ServiceUnavailableError(ERROR_503_CANCEL_REQUEST_FAILED) from exc
    except Exception:
        return JSONResponse(
            status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
            content=error_response(
                "CANCEL_REQUEST_FAILED",
                ERROR_500_CANCEL_REQUEST_FAILED,
            ),
        )

    return success_response(AssetLoanRequestRead.model_validate(asset_loan_request))
