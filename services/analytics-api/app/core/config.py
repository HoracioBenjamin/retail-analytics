"""Configuración del servicio con Pydantic Settings (sección 10, Paso 6).

Único modo implementado en la base: `demo` (Entrega B). Cualquier otro
APP_MODE debe abortar el arranque con un error explícito — nunca un
fallback silencioso (sección 4.1 del plan).
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Base para resolver DEMO_DATASET_PATH sin depender del cwd de la terminal:
# …/services/analytics-api
BASE_DIR = Path(__file__).resolve().parents[2]

IMPLEMENTED_MODES = {"demo"}


class Settings(BaseSettings):
    """Variables del `.env` (o del entorno) con valores de desarrollo seguros."""

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    app_mode: str = "demo"
    # Ruta del fixture canónico, resuelta respecto a services/analytics-api
    # (sección 11 del plan). Puede sobreescribirse por entorno para pruebas.
    demo_dataset_path: str = "../../fixtures/demo-v1.json"

    @property
    def dataset_path(self) -> Path:
        """Ruta absoluta del fixture, desde la base documentada del servicio."""
        candidate = Path(self.demo_dataset_path)
        if not candidate.is_absolute():
            candidate = (BASE_DIR / candidate).resolve()
        return candidate

    def validate(self) -> None:
        """Aborta con mensaje claro si la configuración no es utilizable."""
        if self.app_mode not in IMPLEMENTED_MODES:
            raise RuntimeError(
                f"APP_MODE='{self.app_mode}' no está implementado en la base A+B. "
                "Los modos conectados (Supabase) corresponden a una etapa posterior "
                "del plan; configure APP_MODE=demo para la base actual."
            )
        if self.app_env not in {"development", "production"}:
            raise RuntimeError(f"APP_ENV='{self.app_env}' no reconocido.")


def get_settings() -> Settings:
    return Settings()


def validate_settings_or_fail() -> Settings:
    """Valida y devuelve settings; aborta el arranque con mensaje explícito."""
    settings = get_settings()
    settings.validate()
    return settings
