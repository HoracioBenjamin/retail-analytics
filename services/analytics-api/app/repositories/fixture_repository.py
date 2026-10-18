"""Repositorio del fixture canónico (plan 9.1 / sección 6).

Lee `fixtures/demo-v1.json` (única fuente de datos demo, compartida con el
proveedor demo-local del escritorio), valida cada registro contra los
esquemas pydantic y expone índices por variante. La ruta se resuelve desde
la configuración — nunca desde el cwd de la terminal (Paso 6, punto 4).
Fallo de carga = error explícito en el arranque; sin datos inventados.
"""

import json
from functools import lru_cache
from typing import Any

from pydantic import ValidationError

from app.core.config import Settings, get_settings
from app.schemas.domain import (
    ForecastPoint,
    Recommendation,
    SalesPoint,
    Variant,
)


class FixtureLoadError(RuntimeError):
    """El fixture canónico no existe o no es coherente con el contrato."""


class FixtureRepository:
    """Carga e indexación del dataset demo (inmutable durante la ejecución)."""

    def __init__(self, settings: Settings) -> None:
        path = settings.dataset_path
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError as exc:
            raise FixtureLoadError(
                f"No se encontró el fixture canónico en: {path}. "
                "La base A+B se sirve desde fixtures/demo-v1.json; nada se inventa en runtime."
            ) from exc
        except (json.JSONDecodeError, OSError) as exc:
            raise FixtureLoadError(f"El fixture en {path} no se pudo leer: {exc}") from exc

        try:
            self.dataset_version: str = raw["dataset_version"]
            self.generated: str = raw["generated"]
            self.as_of: str = raw["as_of"]
            self.historical_weeks: int = raw["historical_weeks"]
            self.forecast_weeks: int = raw["forecast_weeks"]
            self.base_currency: str = raw["base_currency"]
            self.variants: list[Variant] = [Variant.model_validate(v) for v in raw["variants"]]
            self.sales_history: list[SalesPoint] = [
                SalesPoint.model_validate(p) for p in raw["sales_history"]
            ]
            self.forecasts: list[ForecastPoint] = [
                ForecastPoint.model_validate(f) for f in raw["forecasts"]
            ]
            self.recommendations: list[Recommendation] = [
                Recommendation.model_validate(r) for r in raw["recommendations"]
            ]
        except (KeyError, TypeError, ValidationError) as exc:
            raise FixtureLoadError(
                f"El fixture en {path} no cumple el contrato del plan (9.2): {exc}"
            ) from exc

        self.history_by_variant: dict[str, list[SalesPoint]] = _group(
            self.sales_history, lambda p: p.variant_id
        )
        self.forecasts_by_variant: dict[str, list[ForecastPoint]] = _group(
            self.forecasts, lambda f: f.variant_id
        )
        self.recommendations_by_variant: dict[str, Recommendation] = {
            r.variant_id: r for r in self.recommendations
        }


def _group(items: list[Any], key) -> dict[str, list[Any]]:
    grouped: dict[str, list[Any]] = {}
    for item in items:
        grouped.setdefault(key(item), []).append(item)
    return grouped


@lru_cache(maxsize=1)
def _singleton() -> FixtureRepository:
    return FixtureRepository(get_settings())


def get_repository() -> FixtureRepository:
    # Un solo dataset por proceso (inmutable; el fixture es determinista).
    return _singleton()


@lru_cache(maxsize=1)
def _test_singleton(path: str) -> FixtureRepository:
    settings: Settings = Settings(demo_dataset_path=path)
    return FixtureRepository(settings)
