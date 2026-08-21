from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config

from app.core.config import get_settings
from app.core.database import Base, engine


def uses_in_memory_sqlite(database_url: str) -> bool:
    return database_url.startswith("sqlite") and (
        ":memory:" in database_url or "mode=memory" in database_url
    )


def run_migrations() -> None:
    settings = get_settings()

    if uses_in_memory_sqlite(settings.database_url):
        import app.models  # noqa: F401

        Base.metadata.create_all(bind=engine)
        return

    backend_root = Path(__file__).resolve().parents[2]
    alembic_ini_path = backend_root / "alembic.ini"
    alembic_config = Config(str(alembic_ini_path))
    alembic_config.set_main_option("script_location", str(backend_root / "alembic"))
    command.upgrade(alembic_config, "head")
