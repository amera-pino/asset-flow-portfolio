import asyncio
import json
import logging
from collections.abc import Callable
from http import HTTPStatus
from logging.handlers import RotatingFileHandler
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from app.constants.error_messages import ERROR_500_INTERNAL_SERVER_ERROR
from app.core import config as config_module
from app.core import database as database_module
from app.core import logger as logger_module
from app.core.config import Settings, get_settings
from app.core.exceptions import (
    ContextualInternalServerError,
    GatewayTimeoutError,
    ServiceUnavailableError,
)
from app.main import (
    app,
    contextual_internal_server_error_handler,
    database_exception_handler,
    gateway_timeout_exception_handler,
    health,
    http_exception_handler,
    service_unavailable_exception_handler,
    unexpected_exception_handler,
    validation_exception_handler,
)
from app.schemas.response import error_response, success_response


class ValidationPayload(BaseModel):
    asset_id: int


def build_exception_test_app() -> FastAPI:
    test_app = FastAPI()
    test_app.add_exception_handler(RequestValidationError, validation_exception_handler)
    test_app.add_exception_handler(HTTPException, http_exception_handler)
    test_app.add_exception_handler(SQLAlchemyError, database_exception_handler)
    test_app.add_exception_handler(
        ContextualInternalServerError,
        contextual_internal_server_error_handler,
    )
    test_app.add_exception_handler(
        ServiceUnavailableError,
        service_unavailable_exception_handler,
    )
    test_app.add_exception_handler(
        GatewayTimeoutError,
        gateway_timeout_exception_handler,
    )
    test_app.add_exception_handler(Exception, unexpected_exception_handler)
    return test_app


async def request_json(
    asgi_app: FastAPI,
    method: str,
    path: str,
    payload: dict | None = None,
    raise_exceptions: bool = True,
) -> tuple[int, dict, str]:
    request_body = b"" if payload is None else json.dumps(payload).encode("utf-8")
    response_start: dict | None = None
    response_body = bytearray()
    messages = [
        {
            "type": "http.request",
            "body": request_body,
            "more_body": False,
        }
    ]

    async def receive() -> dict:
        if messages:
            return messages.pop(0)
        return {"type": "http.disconnect"}

    async def send(message: dict) -> None:
        nonlocal response_start
        if message["type"] == "http.response.start":
            response_start = message
        elif message["type"] == "http.response.body":
            response_body.extend(message.get("body", b""))

    headers = [(b"host", b"testserver")]
    if payload is not None:
        headers.extend(
            [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(request_body)).encode("ascii")),
            ]
        )

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": method,
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": headers,
        "client": ("testclient", 50000),
        "server": ("testserver", 80),
    }

    try:
        await asgi_app(scope, receive, send)
    except Exception:
        if raise_exceptions or response_start is None:
            raise

    assert response_start is not None
    raw_text = response_body.decode("utf-8")
    return response_start["status"], json.loads(raw_text), raw_text


@pytest.fixture
def isolated_asset_flow_logger() -> Callable[[], logging.Logger]:
    logger_module.configure_logging.cache_clear()
    logger_module.get_logger.cache_clear()
    logger = logging.getLogger(logger_module.LOGGER_NAME)

    for handler in list(logger.handlers):
        logger.removeHandler(handler)
        handler.close()

    logger.setLevel(logging.NOTSET)
    logger.propagate = True

    try:
        yield lambda: logger
    finally:
        logger_module.configure_logging.cache_clear()
        logger_module.get_logger.cache_clear()
        for handler in list(logger.handlers):
            logger.removeHandler(handler)
            handler.close()
        logger.setLevel(logging.NOTSET)
        logger.propagate = True


# B-CM-002
def test_error_response_returns_common_api_error_shape() -> None:
    details = [{"loc": ["body", "name"], "msg": "Field required", "type": "missing"}]

    response = error_response("VALIDATION_ERROR", "入力内容を確認してください。", details)

    assert response == {
        "success": False,
        "data": None,
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "入力内容を確認してください。",
            "details": details,
        },
    }


# B-CM-003
def test_main_app_registers_common_exception_handlers() -> None:
    handlers = app.exception_handlers

    assert handlers[RequestValidationError] is validation_exception_handler
    assert handlers[HTTPException] is http_exception_handler
    assert handlers[SQLAlchemyError] is database_exception_handler
    assert handlers[ContextualInternalServerError] is contextual_internal_server_error_handler
    assert handlers[ServiceUnavailableError] is service_unavailable_exception_handler
    assert handlers[GatewayTimeoutError] is gateway_timeout_exception_handler
    assert handlers[Exception] is unexpected_exception_handler


# B-CM-004
def test_validation_exception_handler_returns_common_422_response() -> None:
    test_app = build_exception_test_app()

    @test_app.post("/test-validation")
    def test_validation(payload: ValidationPayload) -> dict:
        return success_response({"asset_id": payload.asset_id})

    status_code, body, _ = asyncio.run(request_json(test_app, "POST", "/test-validation", {}))
    first_detail = body["error"]["details"][0]
    assert status_code == HTTPStatus.UNPROCESSABLE_ENTITY
    assert body["success"] is False
    assert body["data"] is None
    assert body["error"]["code"] == "VALIDATION_ERROR"
    assert body["error"]["message"] == "入力内容を確認してください。"
    assert isinstance(body["error"]["details"], list)
    assert first_detail["loc"] == ["body", "asset_id"]
    assert "required" in first_detail["msg"].lower()
    assert "missing" in first_detail["type"].lower()


# B-CM-005
def test_database_exception_handler_returns_common_500_response() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-database-error")
    def test_database_error() -> None:
        raise SQLAlchemyError("db failed")

    status_code, body, raw_text = asyncio.run(request_json(test_app, "GET", "/test-database-error"))
    assert status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "DATABASE_ERROR",
            "message": ERROR_500_INTERNAL_SERVER_ERROR,
            "details": None,
        },
    }
    assert "db failed" not in raw_text


def test_http_exception_handler_returns_common_error_response() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-http-error")
    def test_http_error() -> None:
        raise HTTPException(status_code=HTTPStatus.UNAUTHORIZED, detail="ログインが必要です。")

    status_code, body, _ = asyncio.run(request_json(test_app, "GET", "/test-http-error"))
    assert status_code == HTTPStatus.UNAUTHORIZED
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "HTTP_ERROR",
            "message": "ログインが必要です。",
            "details": None,
        },
    }


# B-CM-006
def test_contextual_internal_server_error_handler_uses_given_message() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-contextual-error")
    def test_contextual_error() -> None:
        raise ContextualInternalServerError(
            "LOAN_REQUEST_SUBMIT_FAILED",
            "サーバーエラーのため、備品貸出申請の送信に失敗しました。",
        )

    status_code, body, _ = asyncio.run(request_json(test_app, "GET", "/test-contextual-error"))
    assert status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "LOAN_REQUEST_SUBMIT_FAILED",
            "message": "サーバーエラーのため、備品貸出申請の送信に失敗しました。",
            "details": None,
        },
    }


# B-CM-007
def test_contextual_internal_server_error_handler_falls_back_on_blank_message() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-contextual-error-fallback")
    def test_contextual_error_fallback() -> None:
        raise ContextualInternalServerError("LOAN_REQUEST_SUBMIT_FAILED", "")

    status_code, body, _ = asyncio.run(
        request_json(test_app, "GET", "/test-contextual-error-fallback")
    )
    assert status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "LOAN_REQUEST_SUBMIT_FAILED",
            "message": ERROR_500_INTERNAL_SERVER_ERROR,
            "details": None,
        },
    }


# B-CM-008
def test_service_unavailable_exception_handler_returns_common_503_response() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-service-unavailable")
    def test_service_unavailable() -> None:
        raise ServiceUnavailableError("外部サービスが停止中です。")

    status_code, body, _ = asyncio.run(request_json(test_app, "GET", "/test-service-unavailable"))
    assert status_code == HTTPStatus.SERVICE_UNAVAILABLE
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "SERVICE_UNAVAILABLE",
            "message": "外部サービスが停止中です。",
            "details": None,
        },
    }


# B-CM-009
def test_gateway_timeout_exception_handler_returns_common_504_response() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-gateway-timeout")
    def test_gateway_timeout() -> None:
        raise GatewayTimeoutError("外部連携がタイムアウトしました。")

    status_code, body, _ = asyncio.run(request_json(test_app, "GET", "/test-gateway-timeout"))
    assert status_code == HTTPStatus.GATEWAY_TIMEOUT
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "GATEWAY_TIMEOUT",
            "message": "外部連携がタイムアウトしました。",
            "details": None,
        },
    }


# B-CM-010
def test_unexpected_exception_handler_returns_sanitized_common_500_response() -> None:
    test_app = build_exception_test_app()

    @test_app.get("/test-unexpected-error")
    def test_unexpected_error() -> None:
        raise Exception("unexpected failed")

    status_code, body, raw_text = asyncio.run(
        request_json(test_app, "GET", "/test-unexpected-error", raise_exceptions=False)
    )
    assert status_code == HTTPStatus.INTERNAL_SERVER_ERROR
    assert body == {
        "success": False,
        "data": None,
        "error": {
            "code": "INTERNAL_SERVER_ERROR",
            "message": ERROR_500_INTERNAL_SERVER_ERROR,
            "details": None,
        },
    }
    assert "unexpected failed" not in raw_text


# B-CM-011
def test_main_app_registers_health_route() -> None:
    health_route = next(
        route
        for route in app.routes
        if isinstance(route, APIRoute) and route.path == "/health"
    )

    assert "GET" in health_route.methods
    assert health_route.endpoint is health


# B-CM-012
def test_health_route_returns_common_success_response() -> None:
    test_app = FastAPI()
    test_app.get("/health")(health)
    status_code, body, _ = asyncio.run(request_json(test_app, "GET", "/health"))
    assert status_code == HTTPStatus.OK
    assert body == {
        "success": True,
        "data": {"status": "ok"},
        "error": None,
    }


# B-CM-013
def test_settings_cors_origin_list_splits_trims_and_filters_empty_entries() -> None:
    settings = Settings(
        cors_origins=" http://localhost:5173 , https://example.com , , http://127.0.0.1:3000 "
    )

    assert settings.cors_origin_list == [
        "http://localhost:5173",
        "https://example.com",
        "http://127.0.0.1:3000",
    ]


# B-CM-013A
def test_settings_use_secure_none_session_cookie_for_https_cross_origin_client() -> None:
    settings = Settings(cors_origins="https://asset-flow-portfolio.onrender.com")

    assert settings.effective_session_cookie_secure is True
    assert settings.effective_session_cookie_samesite == "none"


# B-CM-013B
def test_settings_keep_explicit_session_cookie_options() -> None:
    settings = Settings(
        cors_origins="https://asset-flow-portfolio.onrender.com",
        session_cookie_secure=False,
        session_cookie_samesite="strict",
    )

    assert settings.effective_session_cookie_secure is True
    assert settings.effective_session_cookie_samesite == "strict"


# B-CM-013C
def test_settings_keep_localhost_cookie_defaults_for_local_dev() -> None:
    settings = Settings(cors_origins="http://localhost:5173,http://127.0.0.1:5173")

    assert settings.effective_session_cookie_secure is False
    assert settings.effective_session_cookie_samesite == "lax"


# B-CM-014
def test_get_settings_reuses_cached_instance(monkeypatch: pytest.MonkeyPatch) -> None:
    get_settings.cache_clear()
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("LOG_TO_FILE", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    first = config_module.get_settings()
    second = config_module.get_settings()

    assert first is second

    get_settings.cache_clear()


class DummySession:
    def __init__(self) -> None:
        self.close_calls = 0

    def close(self) -> None:
        self.close_calls += 1


# B-CM-015
def test_get_db_closes_session_on_normal_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    session = DummySession()
    monkeypatch.setattr(database_module, "SessionLocal", lambda: session)

    generator = database_module.get_db()

    yielded = next(generator)

    assert yielded is session
    with pytest.raises(StopIteration):
        next(generator)
    assert session.close_calls == 1


# B-CM-016
def test_get_db_closes_session_on_exceptional_completion(monkeypatch: pytest.MonkeyPatch) -> None:
    session = DummySession()
    monkeypatch.setattr(database_module, "SessionLocal", lambda: session)
    generator = database_module.get_db()

    yielded = next(generator)

    assert yielded is session
    with pytest.raises(RuntimeError, match="route failed"):
        generator.throw(RuntimeError("route failed"))
    assert session.close_calls == 1


# B-CM-017
def test_configure_logging_is_idempotent_and_prevents_duplicate_handlers(
    monkeypatch: pytest.MonkeyPatch,
    isolated_asset_flow_logger: Callable[[], logging.Logger],
) -> None:
    monkeypatch.setattr(
        logger_module,
        "get_settings",
        lambda: SimpleNamespace(app_env="dev", log_to_file=False),
    )

    first = logger_module.configure_logging()
    first_handler_count = len(first.handlers)
    stream_handlers_after_first = [
        handler for handler in first.handlers if type(handler) is logging.StreamHandler
    ]

    second = logger_module.configure_logging()
    stream_handlers_after_second = [
        handler for handler in second.handlers if type(handler) is logging.StreamHandler
    ]

    assert first is second is isolated_asset_flow_logger()
    assert len(stream_handlers_after_first) == 1
    assert len(stream_handlers_after_second) == 1
    assert len(second.handlers) == first_handler_count


@pytest.mark.parametrize(
    ("app_env", "log_to_file", "expected_level", "expects_rotating_file_handler"),
    [
        pytest.param("dev", False, logging.DEBUG, False, id="B-CM-018-dev-no-file"),
        pytest.param("prod", False, logging.INFO, False, id="B-CM-018-prod-no-file"),
        pytest.param("dev", True, logging.DEBUG, True, id="B-CM-018-dev-with-file"),
        pytest.param("prod", True, logging.INFO, False, id="B-CM-018-prod-with-file"),
    ],
)
def test_configure_logging_applies_environment_specific_settings(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
    isolated_asset_flow_logger: Callable[[], logging.Logger],
    app_env: str,
    log_to_file: bool,
    expected_level: int,
    expects_rotating_file_handler: bool,
) -> None:
    expected_log_path = tmp_path / f"{app_env}-backend.log"
    monkeypatch.setattr(
        logger_module,
        "get_settings",
        lambda: SimpleNamespace(app_env=app_env, log_to_file=log_to_file),
    )
    monkeypatch.setattr(logger_module, "_resolve_log_path", lambda: expected_log_path)

    logger = logger_module.configure_logging()

    stream_handlers = [
        handler for handler in logger.handlers if type(handler) is logging.StreamHandler
    ]
    file_handlers = [
        handler for handler in logger.handlers if isinstance(handler, RotatingFileHandler)
    ]

    assert logger is isolated_asset_flow_logger()
    assert logger.level == expected_level
    assert len(stream_handlers) == 1
    assert stream_handlers[0].level == expected_level
    assert (len(file_handlers) == 1) is expects_rotating_file_handler

    if expects_rotating_file_handler:
        assert Path(file_handlers[0].baseFilename) == expected_log_path
        assert expected_log_path.parent.exists()
