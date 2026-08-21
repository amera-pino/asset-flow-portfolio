from datetime import UTC, datetime, timedelta
import hashlib
import secrets
from typing import Annotated

from fastapi import Cookie, Depends, Header, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.constants.error_messages import ERROR_AUTH_UNAUTHORIZED
from app.core.config import get_settings
from app.core.database import get_db
from app.models.user import User
from app.models.user_session import UserSession


settings = get_settings()
SESSION_COOKIE_NAME = "assetflow_session"


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_user_session(db: Session, user_id: int) -> str:
    session_token = generate_session_token()
    expires_at = datetime.now(UTC) + timedelta(seconds=settings.session_max_age_seconds)
    db.add(
        UserSession(
            user_id=user_id,
            token_hash=hash_session_token(session_token),
            expires_at=expires_at,
        )
    )
    db.commit()
    return session_token


def set_session_cookie(response: Response, session_token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite=settings.effective_session_cookie_samesite,
        secure=settings.effective_session_cookie_secure,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        samesite=settings.effective_session_cookie_samesite,
        secure=settings.effective_session_cookie_secure,
        path="/",
    )


def delete_session_by_token(db: Session, session_token: str | None) -> None:
    if not session_token:
        return

    db.execute(
        delete(UserSession).where(UserSession.token_hash == hash_session_token(session_token))
    )
    db.commit()


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None

    return token.strip()


def get_session_token(
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> str | None:
    return extract_bearer_token(authorization) or session_token


def resolve_current_user(db: Session, session_token: str | None) -> User | None:
    if not session_token:
        return None

    now = datetime.now(UTC)
    session = db.scalar(
        select(UserSession).where(
            UserSession.token_hash == hash_session_token(session_token),
            UserSession.expires_at > now,
        )
    )
    if session is None:
        return None

    return db.get(User, session.user_id)


def get_optional_current_user(
    db: Annotated[Session, Depends(get_db)],
    session_token: Annotated[str | None, Depends(get_session_token)] = None,
) -> User | None:
    return resolve_current_user(db, session_token)


def get_current_user(
    current_user: Annotated[User | None, Depends(get_optional_current_user)],
) -> User:
    if current_user is None:
        raise HTTPException(status_code=401, detail=ERROR_AUTH_UNAUTHORIZED)
    return current_user
