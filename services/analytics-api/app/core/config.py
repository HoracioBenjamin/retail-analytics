"""Configuración del servicio con Pydantic Settings (Paso 6 + etapa C).

Modos: `demo` (fixture canónico) y `connected` (Supabase vía REST, solo
SELECT). Connected acepta una clave publicable (respeta RLS) o, para uso
local privado, una Secret Key (omite RLS). Cualquier otro APP_MODE aborta
el arranque con un error explícito — nunca un fallback silencioso.

Reglas de credenciales: los errores indican qué VARIABLE falta, jamás
imprimen el contenido de las variables.
"""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Base para resolver DEMO_DATASET_PATH sin depender del cwd de la terminal:
# …/services/analytics-api
BASE_DIR = Path(__file__).resolve().parents[2]

IMPLEMENTED_MODES = {"demo", "connected"}


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

    # ── Supabase (URL y una clave requeridas en APP_MODE=connected) ──
    supabase_url: str = ""
    supabase_publishable_key: str = ""
    supabase_secret_key: str = ""
    # Optional: without a real supplier lead time, stockout recommendations stay informational.
    supplier_lead_time_weeks: float | None = None

    @property
    def dataset_path(self) -> Path:
        """Ruta absoluta del fixture, desde la base documentada del servicio."""
        candidate = Path(self.demo_dataset_path)
        if not candidate.is_absolute():
            candidate = (BASE_DIR / candidate).resolve()
        return candidate

    def validate(self) -> None:
        """Aborta con mensaje claro si la configuración no es utilizable.

        Nunca imprime el contenido de variables: solo sus NOMBRES.
        """
        if self.app_mode not in IMPLEMENTED_MODES:
            raise RuntimeError(
                f"APP_MODE='{self.app_mode}' no está implementado. "
                "Valores válidos: demo, connected."
            )
        if self.app_env not in {"development", "production"}:
            raise RuntimeError(f"APP_ENV='{self.app_env}' no reconocido.")
        if self.supabase_uses_secret_key and self.app_env != "development":
            raise RuntimeError(
                "SUPABASE_SECRET_KEY solo está permitida con APP_ENV=development "
                "en este proyecto."
            )
        if self.supplier_lead_time_weeks is not None and self.supplier_lead_time_weeks <= 0:
            raise RuntimeError("SUPPLIER_LEAD_TIME_WEEKS debe ser mayor que cero.")
        if self.app_mode == "connected":
            missing = []
            if not self._configured(self.supabase_url):
                missing.append("SUPABASE_URL")
            if not (
                self._configured(self.supabase_secret_key)
                or self._configured(self.supabase_publishable_key)
            ):
                missing.append("SUPABASE_SECRET_KEY o SUPABASE_PUBLISHABLE_KEY")
            if missing:
                raise RuntimeError(
                    "APP_MODE=connected requiere llenar en services/analytics-api/.env: "
                    + ", ".join(missing)
                    + ". (Placeholders con <...> cuentan como vacíos.)"
                )

    @staticmethod
    def _configured(value: str) -> bool:
        return bool(value.strip()) and not value.strip().startswith("<")

    @property
    def supabase_api_key(self) -> str:
        """Usa Secret Key si se configura; de lo contrario, la clave publicable."""
        if self._configured(self.supabase_secret_key):
            return self.supabase_secret_key
        return self.supabase_publishable_key

    @property
    def supabase_uses_secret_key(self) -> bool:
        return self._configured(self.supabase_secret_key)

    @property
    def supabase_rest_base(self) -> str:
        """Base de la API REST de Supabase (PostgREST), sin credenciales embebidas."""
        return self.supabase_url.rstrip("/") + "/rest/v1"


def get_settings() -> Settings:
    return Settings()


def validate_settings_or_fail() -> Settings:
    """Valida y devuelve settings; aborta el arranque con mensaje explícito."""
    settings = get_settings()
    settings.validate()
    return settings
