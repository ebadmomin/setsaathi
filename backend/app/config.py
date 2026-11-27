from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    secret_key: str = "development-only-change-me"
    initial_admin_name: str = "SetSaathi Admin"
    initial_admin_username: str = "administrator"
    initial_admin_email: str = "admin@example.com"
    initial_admin_mobile: str = "+919999999999"
    initial_admin_password: str = "administrator"
    initial_staff_password: str = ""
    initial_staff_email: str = "staff1@setsaathi.example.com"
    initial_staff_mobile: str = "+919000000001"
    access_token_minutes: int = 30
    openrouter_api_key: str = ""
    openrouter_model: str = "openrouter/free"
    site_url: str = "http://127.0.0.1:5173"
    port: int = 8007
    database_path: Path = Path("setsaathi.db")
    database_url: str | None = None
    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5174,http://localhost:5174"
    gym_lookup_url: str = "https://nominatim.openstreetmap.org/search"
    gym_lookup_user_agent: str = "SetSaathi/0.1 (user-initiated gym lookup)"
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore")

    @property
    def database_dsn(self) -> str:
        if self.database_url:
            return self.database_url
        path = self.database_path
        if not path.is_absolute():
            path = Path(__file__).resolve().parents[1] / path
        return f"sqlite:///{path.resolve().as_posix()}"

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
