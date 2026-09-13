from functools import lru_cache
from urllib.parse import urlsplit

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    ml_service_ws_url: str = "ws://localhost:8000/ws/telemetry"
    ml_service_rest_url: str = "http://localhost:8000"
    frontend_origin: str = "http://localhost:3000"
    port: int = 8001
    sustainability_simulator_enabled: bool = True
    sustainability_simulator_interval_seconds: int = 60

    @property
    def async_database_url(self) -> URL:
        # Built as a structured sqlalchemy.engine.URL (not a re-parsed string):
        # the Supabase password may contain characters (e.g. "@") that make a
        # raw DSN string ambiguous to re-parse (asyncpg's own DSN parser splits
        # on the wrong "@" in that case, corrupting the host). urlsplit() below
        # is only used once, on the original trusted string, to pull out each
        # component (it percent-decodes username/password correctly using the
        # right-most "@" for the userinfo/host boundary).
        parts = urlsplit(self.database_url)
        database = parts.path.lstrip("/") or "postgres"
        return URL.create(
            drivername="postgresql+asyncpg",
            username=parts.username,
            password=parts.password,
            host=parts.hostname,
            port=parts.port,
            database=database,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
