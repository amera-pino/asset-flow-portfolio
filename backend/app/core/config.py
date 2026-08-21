from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "dev"
    log_to_file: bool = False
    database_url: str = "postgresql+psycopg2://assetflow:assetflow_password@db:5432/assetflow"
    cors_origins: str = "http://localhost:5173"
    session_max_age_seconds: int = 60 * 60 * 24 * 7
    session_cookie_secure: bool = False
    session_cookie_samesite: str = "lax"
    render: bool = False

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def has_cross_origin_https_client(self) -> bool:
        return any(
            origin.startswith("https://")
            and "localhost" not in origin
            and "127.0.0.1" not in origin
            for origin in self.cors_origin_list
        )

    @property
    def effective_session_cookie_secure(self) -> bool:
        return self.session_cookie_secure or self.render or self.has_cross_origin_https_client

    @property
    def effective_session_cookie_samesite(self) -> str:
        if (
            (self.render or self.has_cross_origin_https_client)
            and self.session_cookie_samesite == "lax"
        ):
            return "none"
        return self.session_cookie_samesite


@lru_cache
def get_settings() -> Settings:
    return Settings()
