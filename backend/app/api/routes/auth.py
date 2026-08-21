from http import HTTPStatus
from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.constants.error_messages import ERROR_AUTH_INVALID_CREDENTIALS
from app.core.auth import (
    clear_session_cookie,
    create_user_session,
    delete_session_by_token,
    get_current_user,
    get_optional_current_user,
    get_session_token,
    set_session_cookie,
)
from app.core.database import get_db
from app.core.security import verify_password
from app.models.user import User
from app.schemas.auth import AuthStatus, LoginRequest, LoginUser
from app.schemas.response import ApiResponse, error_response, success_response

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse[LoginUser])
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
    response: Response,
) -> dict | JSONResponse:
    user = db.scalar(
        select(User).where(func.lower(User.login_id) == payload.login_id.strip().lower())
    )

    if user is None or not verify_password(payload.password, user.password_hash):
        return JSONResponse(
            status_code=HTTPStatus.UNAUTHORIZED,
            content=error_response("INVALID_CREDENTIALS", ERROR_AUTH_INVALID_CREDENTIALS),
        )

    session_token = create_user_session(db, user.id)
    set_session_cookie(response, session_token)

    return success_response(
        LoginUser(
            id=user.id,
            name=user.name,
            login_id=user.login_id,
            role=user.role,
            session_token=session_token,
        )
    )


@router.get("/me", response_model=ApiResponse[LoginUser])
def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> dict:
    return success_response(
        LoginUser(
            id=current_user.id,
            name=current_user.name,
            login_id=current_user.login_id,
            role=current_user.role,
        )
    )


@router.post("/logout", response_model=ApiResponse[AuthStatus])
def logout(
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
    session_token: Annotated[str | None, Depends(get_session_token)] = None,
) -> dict:
    del current_user
    delete_session_by_token(db, session_token)
    clear_session_cookie(response)
    return success_response(AuthStatus(status="ok"))
