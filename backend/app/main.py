from contextlib import asynccontextmanager
from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from app.api.routes import admin, assets, auth, requests
from app.constants.error_messages import ERROR_500_INTERNAL_SERVER_ERROR
from app.core.config import get_settings
from app.core.exceptions import (
    ContextualInternalServerError,
    GatewayTimeoutError,
    ServiceUnavailableError,
)
from app.core.logger import get_logger
from app.core.migrations import run_migrations
from app.seeds import seed_development_data
from app.schemas.response import error_response, success_response

logger = get_logger(__name__)

# API 起動時に DB テーブルを用意するアプリ全体の入口処理
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Backend API startup")
    try:
        if settings.app_env == "dev":
            seed_development_data()
        else:
            run_migrations()
            logger.info("Seed skipped because APP_ENV=%s", settings.app_env)
    except Exception:
        logger.exception("Failed to initialize database schema")
        raise

    logger.info("Database schema is ready")
    yield
    logger.info("Backend API shutdown")


settings = get_settings()

app = FastAPI(title="AssetFlow API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(assets.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(requests.router, prefix="/api")


# FastAPI の入力検証エラーを共通エラー形式に変換する
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    logger.warning("Validation error on %s %s: %s", request.method, request.url.path, exc.errors())
    return JSONResponse(
        status_code=HTTPStatus.UNPROCESSABLE_ENTITY,
        content=error_response(
            "VALIDATION_ERROR",
            "入力内容を確認してください。",
            exc.errors(),
        ),
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.warning("HTTP error on %s %s: %s", request.method, request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response("HTTP_ERROR", str(exc.detail)),
    )


# DB 層の例外を API 共通レスポンスの 500 エラーに変換する
@app.exception_handler(SQLAlchemyError)
async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Database error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        content=error_response(
            "DATABASE_ERROR",
            ERROR_500_INTERNAL_SERVER_ERROR,
        ),
    )


@app.exception_handler(ContextualInternalServerError)
async def contextual_internal_server_error_handler(
    request: Request,
    exc: ContextualInternalServerError,
) -> JSONResponse:
    logger.exception("Contextual internal error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(
            exc.code,
            exc.message or ERROR_500_INTERNAL_SERVER_ERROR,
        ),
    )


@app.exception_handler(ServiceUnavailableError)
async def service_unavailable_exception_handler(
    request: Request,
    exc: ServiceUnavailableError,
) -> JSONResponse:
    logger.warning("Service unavailable on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.code, exc.message),
    )


@app.exception_handler(GatewayTimeoutError)
async def gateway_timeout_exception_handler(
    request: Request,
    exc: GatewayTimeoutError,
) -> JSONResponse:
    logger.warning("Gateway timeout on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response(exc.code, exc.message),
    )


# 想定外例外を API 共通レスポンスの 500 エラーに変換する
@app.exception_handler(Exception)
async def unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unexpected error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=HTTPStatus.INTERNAL_SERVER_ERROR,
        content=error_response(
            "INTERNAL_SERVER_ERROR",
            ERROR_500_INTERNAL_SERVER_ERROR,
        ),
    )


# 稼働確認用の軽量なヘルスチェックエンドポイント
@app.get("/health")
def health() -> dict:
    return success_response({"status": "ok"})
