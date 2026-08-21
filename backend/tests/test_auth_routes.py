import json
from http import HTTPStatus
from http.cookies import SimpleCookie

from fastapi import Response
from fastapi.responses import JSONResponse
from sqlalchemy import select

from app.api.routes.auth import login
from app.core.auth import SESSION_COOKIE_NAME, get_session_token, hash_session_token
from app.core.security import hash_password
from app.models.user_session import UserSession
from app.schemas.auth import LoginRequest, LoginUser


def response_json(response: JSONResponse) -> dict:
    return json.loads(response.body.decode("utf-8"))


def session_cookie_value(response: Response) -> str:
    cookie = SimpleCookie()
    cookie.load(response.headers["set-cookie"])
    return cookie[SESSION_COOKIE_NAME].value


def test_login_returns_general_user(db_session, user_factory) -> None:
    user_factory(
        id=1,
        name="一般ユーザー",
        login_id="user@example.com",
        password_hash=hash_password("AssetFlow2026!"),
    )

    http_response = Response()
    response = login(
        LoginRequest(login_id="user@example.com", password="AssetFlow2026!"),
        db_session,
        http_response,
    )

    sessions = db_session.scalars(select(UserSession)).all()

    assert response["success"] is True
    assert isinstance(response["data"], LoginUser)
    assert response["data"].role == "user"
    assert response["data"].name == "一般ユーザー"
    assert response["data"].session_token
    assert len(sessions) == 1
    assert sessions[0].user_id == 1
    assert f"{SESSION_COOKIE_NAME}=" in http_response.headers["set-cookie"]
    assert (
        hash_session_token(session_cookie_value(http_response))
        == sessions[0].token_hash
    )


def test_login_returns_admin_user(db_session, user_factory) -> None:
    user_factory(
        id=2,
        name="管理者",
        login_id="admin@example.com",
        password_hash=hash_password("AssetFlow2026!"),
        role="admin",
    )

    http_response = Response()
    response = login(
        LoginRequest(login_id="admin@example.com", password="AssetFlow2026!"),
        db_session,
        http_response,
    )

    sessions = db_session.scalars(select(UserSession)).all()

    assert response["success"] is True
    assert response["data"].role == "admin"
    assert response["data"].name == "管理者"
    assert response["data"].session_token
    assert len(sessions) == 1
    assert sessions[0].user_id == 2
    assert f"{SESSION_COOKIE_NAME}=" in http_response.headers["set-cookie"]
    assert (
        hash_session_token(session_cookie_value(http_response))
        == sessions[0].token_hash
    )


def test_login_rejects_invalid_credentials(db_session, user_factory) -> None:
    user_factory(
        id=1,
        name="一般ユーザー",
        login_id="user@example.com",
        password_hash=hash_password("AssetFlow2026!"),
    )

    http_response = Response()
    response = login(
        LoginRequest(login_id="user@example.com", password="wrong"),
        db_session,
        http_response,
    )
    body = response_json(response)
    sessions = db_session.scalars(select(UserSession)).all()

    assert response.status_code == HTTPStatus.UNAUTHORIZED
    assert body["success"] is False
    assert body["error"]["code"] == "INVALID_CREDENTIALS"
    assert sessions == []
    assert "set-cookie" not in http_response.headers


def test_get_session_token_prefers_bearer_authorization() -> None:
    assert (
        get_session_token(
            "cookie-token",
            "Bearer header-token",
        )
        == "header-token"
    )


def test_get_session_token_falls_back_to_cookie() -> None:
    assert get_session_token("cookie-token", None) == "cookie-token"
