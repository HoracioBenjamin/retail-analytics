"""Routers de la API demo: `/health` y `/api/v1/*` (plan 9.4).

Cada endpoint devuelve el sobre uniforme del plan: `data` + `meta`; los
listados añaden `pagination`. Los parámetros replican los contratos del
escritorio (misma semántica de filtros) para que el Paso 7 conmute
proveedores sin tocar la UI.
"""

from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.repositories.fixture_repository import get_repository
from app.schemas.domain import RiskLevel
from app.services.analytics_service import AnalyticsService
from app.services.analytics_service_connected import AnalyticsServiceConnected

health_router = APIRouter()
api_v1_router = APIRouter()

def response_meta() -> dict[str, str]:
    """Etiqueta HONESTA del modo de datos de la respuesta:
    demo→'demo-api' (fixture por HTTP), connected→'connected' (Supabase)."""
    from app.core.config import get_settings

    settings = get_settings()
    return {"mode": "demo-api" if settings.app_mode == "demo" else "connected"}


class Envelope(BaseModel):
    """Sobre de respuesta uniforme: data + meta; listados suman pagination."""

    data: Any
    meta: dict[str, str] | None = None
    pagination: dict[str, int] | None = None


def _serialize(obj: Any) -> Any:
    """pydantic model → dict; lista/tupla → recursivo; resto tal cual."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump()
    if isinstance(obj, (list, tuple)):
        return [_serialize(item) for item in obj]
    return obj


def envelope(data: Any, pagination: Any | None = None) -> dict:
    payload: dict[str, Any] = {
        "ok": True,  # mismo sobre tipado que el puente IPC del escritorio
        "data": _serialize(data),
        "meta": response_meta(),
    }
    if pagination is not None:
        payload["pagination"] = _serialize(pagination)
    return payload


def _service(
    refresh: bool = Query(False, include_in_schema=False),
) -> AnalyticsService | AnalyticsServiceConnected:
    """Selecciona el servicio según APP_MODE del backend (demo|connected).

    El fixture solo se carga en demo; connected lee exclusivamente Supabase.
    """
    from app.core.config import get_settings

    settings = get_settings()
    if settings.app_mode == "connected":
        from app.repositories.supabase_rest import get_connected_repo, reset_connected_cache
        from app.services.analytics_service_connected import AnalyticsServiceConnected

        if refresh:
            reset_connected_cache()
        return AnalyticsServiceConnected(get_connected_repo())
    return AnalyticsService(get_repository())


# ── GET /health ─────────────────────────────────────────────────────────


@health_router.get("/health", summary="Estado del servicio y modo")
def health(service: AnalyticsService | AnalyticsServiceConnected = Depends(_service)) -> dict:
    # Plan 9.4: el health acredita servicio vivo y modo; NO afirma permisos
    # ni integridad de una BD a la que la base A/B no se conecta.
    return service.health_payload()


# ── GET /api/v1/data-status ────────────────────────────────────────────


@api_v1_router.get("/data-status", summary="Metadatos del dataset y capacidades")
def data_status(service: AnalyticsService = Depends(_service)) -> dict:
    return envelope(service.get_data_status())


# ── GET /api/v1/filters ────────────────────────────────────────────────


@api_v1_router.get("/filters", summary="Modelos, colores y tallas disponibles")
def filters(service: AnalyticsService = Depends(_service)) -> dict:
    return envelope(service.get_filters())


# ── GET /api/v1/overview ───────────────────────────────────────────────


@api_v1_router.get("/overview", summary="KPIs y agregaciones del período solicitado")
def overview(
    service: AnalyticsService = Depends(_service),
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD"),
    model: str | None = Query(None, max_length=80),
    color: str | None = Query(None, max_length=40),
    size: str | None = Query(None, max_length=10),
) -> dict:
    result = service.get_overview(
        date_from=date_from, date_to=date_to, model=model, color=color, size=size
    )
    return envelope(result)


# ── GET /api/v1/variants ───────────────────────────────────────────────


@api_v1_router.get("/variants", summary="Listado filtrado y paginado")
def variants(
    service: AnalyticsService = Depends(_service),
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD"),
    model: str | None = Query(None, max_length=80),
    color: str | None = Query(None, max_length=40),
    size: str | None = Query(None, max_length=10),
    horizon_weeks: int | None = Query(None, ge=1, le=24),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
) -> dict:
    rows, pagination = service.list_variants(
        date_from=date_from,
        date_to=date_to,
        model=model,
        color=color,
        size=size,
        horizon_weeks=horizon_weeks,
        page=page,
        page_size=page_size,
    )
    return envelope(rows, pagination)


# ── GET /api/v1/variants/{variant_id} ──────────────────────────────────


@api_v1_router.get(
    "/variants/{variant_id}",
    summary="Detalle de una variante (404 si no existe)",
    responses={404: {"description": "Variante desconocida"}},
)
def variant_detail(
    variant_id: str,
    service: AnalyticsService = Depends(_service),
) -> dict:
    return envelope(service.get_variant(variant_id))
    # NotFoundVariantError → handler global: 404 {"error": {code: "NOT_FOUND"}}


# ── GET /api/v1/forecasts ──────────────────────────────────────────────


@api_v1_router.get("/forecasts", summary="Historial + pronóstico disponible por variante")
def forecasts(
    service: AnalyticsService = Depends(_service),
    variant_id: str = Query(..., max_length=120),
    date_from: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD"),
    date_to: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="YYYY-MM-DD"),
    horizon_weeks: int | None = Query(None, ge=1, le=24),
) -> dict:
    series = service.get_forecasts(
        variant_id=variant_id,
        date_from=date_from,
        date_to=date_to,
        horizon_weeks=horizon_weeks,
    )
    return envelope(series)


# ── GET /api/v1/recommendations ────────────────────────────────────────


@api_v1_router.get("/recommendations", summary="Recomendaciones filtradas por datos y umbrales")
def recommendations(
    service: AnalyticsService = Depends(_service),
    model: str | None = Query(None, max_length=80),
    color: str | None = Query(None, max_length=40),
    size: str | None = Query(None, max_length=10),
    risk: RiskLevel | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
) -> dict:
    rows, pagination = service.get_recommendations(
        model=model, color=color, size=size, risk=risk, page=page, page_size=page_size
    )
    return envelope(rows, pagination)
