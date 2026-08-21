from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()


def create_database_engine():
    engine_options: dict[str, object] = {
        "pool_pre_ping": True,
    }

    if settings.database_url.startswith("sqlite"):
        engine_options["connect_args"] = {"check_same_thread": False}

        if ":memory:" in settings.database_url or "mode=memory" in settings.database_url:
            engine_options["poolclass"] = StaticPool

    return create_engine(settings.database_url, **engine_options)


engine = create_database_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
