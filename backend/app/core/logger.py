from __future__ import annotations

import logging
from functools import lru_cache
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.core.config import get_settings

LOGGER_NAME = "asset_flow"
LOGGER_FORMAT = "%(asctime)s [%(levelname)s] %(name)s.%(funcName)s: %(message)s"
CONTAINER_LOG_PATH = Path("/workspace/logs/backend.log")
LOCAL_LOG_PATH = Path("logs/backend.log")


def _resolve_log_path() -> Path:
    if Path("/workspace").exists():
        return CONTAINER_LOG_PATH

    return LOCAL_LOG_PATH


@lru_cache
def configure_logging() -> logging.Logger:
    settings = get_settings()
    logger = logging.getLogger(LOGGER_NAME)

    if logger.handlers:
        return logger

    level = logging.DEBUG if settings.app_env == "dev" else logging.INFO
    formatter = logging.Formatter(LOGGER_FORMAT)

    logger.setLevel(level)
    logger.propagate = False

    stream_handler = logging.StreamHandler()
    stream_handler.setLevel(level)
    stream_handler.setFormatter(formatter)
    logger.addHandler(stream_handler)

    if settings.app_env == "dev" and settings.log_to_file:
        log_path = _resolve_log_path()
        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = RotatingFileHandler(
            log_path,
            maxBytes=1_000_000,
            backupCount=3,
            encoding="utf-8",
        )
        file_handler.setLevel(level)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


@lru_cache
def get_logger(name: str | None = None) -> logging.Logger:
    configure_logging()
    return logging.getLogger(f"{LOGGER_NAME}.{name}" if name else LOGGER_NAME)
