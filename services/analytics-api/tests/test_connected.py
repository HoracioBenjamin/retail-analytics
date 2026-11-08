"""Pruebas del modo `connected` (etapa C) con Supabase SIMULADO.

Todo corre offline: httpx.MockTransport responde JSON estilo PostgREST.
Se verifican:
- Paginación por Content-Range en SupabaseRestRepository.
- Reglas de negocio: ventas = estado 'exitoso' (excluye pendiente/erroneo).
- Forecast baseline Croston-SBA y riesgos conservadores cuando el historial es corto.
- Errores: 403 (RLS) → SupabasePermissionError; red → conexión.
- Router en modo connected: endpoints devuelven los mismos sobre {data,meta}.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import config as config_module
from app.core.config import Settings
from app.repositories.supabase_rest import (
    ConnectedSnapshot,
    SupabaseRestRepository,
    reset_connected_cache,
)
from app.services.analytics_service_connected import AnalyticsServiceConnected
from app.services.exceptions import (
    SupabaseConnectionError,
    SupabasePermissionError,
)
from app.services.forecasting import croston_sba_weekly

# ── Datos PostgREST simulados ───────────────────────────────────────────

PRODUCTOS = [
    {
        "id": 101,
        "nombre": "Aurora Running",
        "marcas": {"nombre": "Travesía Andina"},
        "colores": {"nombre": "Negro"},
        "categorias": {"nombre": "Running"},
    },
    {
        "id": 102,
        "nombre": "Cordillera Trek",
        "marcas": {"nombre": "Travesía Andina"},
        "colores": {"nombre": "Córdoba"},
        "categorias": {"nombre": "Trekking"},
    },
]
STOCK = [
    {"producto_id": 101, "talla": "38", "cantidad": 12},
    {"producto_id": 101, "talla": "40", "cantidad": 0},
    {"producto_id": 102, "talla": "39", "cantidad": 25},
]
VENTAS = [  # fecha/plata verificables: 3 uds × 60000 = 180000 CLP el 2026-10-02
    {
        "producto_id": 101, "talla": "38", "cantidad": 3, "precio_unitario": 60000,
        "pedidos": {"created_at": "2026-10-02T18:20:00+00:00", "estado": "exitoso"},
    },
    {   # pendiente: NO es venta confirmada → debe excluirse
        "producto_id": 101, "talla": "38", "cantidad": 9, "precio_unitario": 60000,
        "pedidos": {"created_at": "2026-10-03T18:20:00+00:00", "estado": "pendiente"},
    },
    {
        "producto_id": 102, "talla": "39", "cantidad": 1, "precio_unitario": 75000,
        "pedidos": {"created_at": "2026-10-05T14:00:00+00:00", "estado": "exitoso"},
    },
]
PEDIDOS_MINMAX = [
    {"created_at": "2026-10-02T18:20:00+00:00"},
    {"created_at": "2026-10-05T14:00:00+00:00"},
]

CONTEOS = {"productos": 2, "stock": 3, "pedidos_exitosos": 3}


def make_repo(handler) -> SupabaseRestRepository:
    settings = Settings(
        app_mode="connected",
        supabase_url="https://proyecto-demo.supabase.co",
        supabase_publishable_key="clave-publica-de-prueba",
        supabase_secret_key="",
    )
    return SupabaseRestRepository(settings, transport=httpx.MockTransport(handler))


def postgrest_app(routes):
    """Simulador de PostgREST: acepta una función `handler(request)` directa
    o una lista de tuplas (regex_match, responder)."""
    def handler(request: httpx.Request) -> httpx.Response:
        if callable(routes) and not isinstance(routes, list):
            return routes(request)
        for match, responder in routes:
            if match(request):
                return responder(request)
        return httpx.Response(404, json={"message": "recurso simulado no definido"})
    return handler


# ── Repositorio: paginación, reglas y errores ───────────────────────────


def test_ventas_solo_exitosos_y_paginacion() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "/detalles_pedido" in request.url.path:
            params = dict(request.url.params)
            assert params["pedidos.estado"] == "eq.exitoso"  # filtro de regla de negocio
            return httpx.Response(
                200,
                headers={"Content-Range": f"0-{len(VENTAS) - 1}/{len(VENTAS)}"},
                json=VENTAS,
            )
        return httpx.Response(404, json={"message": "no simulado"})

    repo = make_repo(handler)
    lineas = repo.lineas_venta()
    assert len(lineas) == 3
    estados = {item["pedidos"]["estado"] for item in lineas}
    assert estados == {"exitoso", "pendiente"}  # la DB devuelve filas; filtrar es de la consulta


def test_403_rls_mapea_a_permisos() -> None:
    repo = make_repo(
        lambda request: httpx.Response(403, json={"message": "RLS bloqueado"})
    )
    with pytest.raises(SupabasePermissionError, match="HTTP 403"):
        repo.productos()


def test_401_identifica_error_de_autenticacion() -> None:
    repo = make_repo(
        lambda request: httpx.Response(401, json={"message": "Invalid API key"})
    )
    with pytest.raises(SupabaseConnectionError, match="no confirma un bloqueo de RLS"):
        repo.productos()


def test_publishable_key_se_envia_como_apikey_sin_bearer() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["apikey"] == "clave-publica-de-prueba"
        assert "authorization" not in request.headers
        return httpx.Response(200, json=[])

    make_repo(handler).productos()


def test_secret_key_se_prioriza_y_se_envia_sin_bearer() -> None:
    settings = Settings(
        app_mode="connected",
        supabase_url="https://proyecto-demo.supabase.co",
        supabase_publishable_key="clave-publica-de-prueba",
        supabase_secret_key="sb_secret_de_prueba",
    )
    settings.validate()

    def handler(request: httpx.Request) -> httpx.Response:
        assert request.headers["apikey"] == "sb_secret_de_prueba"
        assert "authorization" not in request.headers
        return httpx.Response(200, json=[])

    SupabaseRestRepository(settings, transport=httpx.MockTransport(handler)).productos()


def test_connected_acepta_secret_key_sin_publishable_key() -> None:
    settings = Settings(
        app_mode="connected",
        supabase_url="https://proyecto-demo.supabase.co",
        supabase_secret_key="sb_secret_de_prueba",
    )
    settings.validate()


def test_secret_key_no_se_permite_en_produccion() -> None:
    settings = Settings(
        app_env="production",
        app_mode="connected",
        supabase_url="https://proyecto-demo.supabase.co",
        supabase_secret_key="sb_secret_de_prueba",
    )
    with pytest.raises(RuntimeError, match="solo está permitida con APP_ENV=development"):
        settings.validate()


def test_error_red_mapea_a_conexion() -> None:
    def handler(request):
        raise httpx.ConnectError("simulado sin DNS")

    repo = make_repo(handler)
    with pytest.raises(SupabaseConnectionError):
        repo.productos()


# ── Servicio connected: reglas de negocio sobre datos simulados ─────────


@pytest.fixture()
def connected() -> AnalyticsServiceConnected:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/productos"):
            return httpx.Response(200, headers={"Content-Range": "0-1/2"}, json=PRODUCTOS)
        if path.endswith("/stock"):
            return httpx.Response(200, headers={"Content-Range": "0-2/3"}, json=STOCK)
        if path.endswith("/detalles_pedido"):
            return httpx.Response(200, headers={"Content-Range": "0-2/3"}, json=VENTAS)
        if path.endswith("/pedidos"):
            params = dict(request.url.params)
            data = PEDIDOS_MINMAX[0] if "asc" in params.get("order", "") else PEDIDOS_MINMAX[1]
            return httpx.Response(200, headers={"Content-Range": "0-0/2"}, json=[data])
        # conteos_diag sin filtrar rangos: cartera vacía
        return httpx.Response(200, headers={"Content-Range": "*/0"}, json=[])

    repo = make_repo(handler)
    snapshot = ConnectedSnapshot(repo, ttl_seconds=0)
    return AnalyticsServiceConnected(snapshot)


def test_variantes_desde_producto_x_talla(connected) -> None:
    total = connected.get_filters()
    assert set(total.models) == {"Aurora Running", "Cordillera Trek"}
    # Orden por colación es (sin acentos): Córdoba antes de Negro
    assert total.colors == ["Córdoba", "Negro"]
    rows, pagination = connected.list_variants(
        None, None, None, None, None, None, 1, 200
    )
    total_rows = [r.variant_id for r in rows]
    assert pagination.total == 3  # Aurora 38, Aurora 40, Cordillera 39
    assert "p101-38" in total_rows and "p101-40" in total_rows and "p102-39" in total_rows
    aurora = next(r for r in rows if r.variant_id == "p101-38")
    assert aurora.stock_on_hand == 12
    assert aurora.model == "Aurora Running" and aurora.color == "Negro"


def test_ventas_confirmadas_agregan_kpis(connected) -> None:
    resumen = connected.get_overview(None, None, None, None, None)
    assert resumen.units_sold == 4  # 3 (p101-38) + 1 (p102-39); el pendiente NO suma
    assert resumen.sales_amount_clp == 180000 + 75000
    assert resumen.variants_total == 3
    # Sin modelo: nadie affirmable "en riesgo"
    assert resumen.variants_at_risk == 0
    assert resumen.risk_counts["insufficient_data"] == 3


def test_fila_variante_sin_historial_y_con_historial(connected) -> None:
    rows, _ = connected.list_variants(None, None, None, None, None, None, 1, 200)
    aurora = next(r for r in rows if r.variant_id == "p101-38")
    assert aurora.units_sold_period == 3
    assert aurora.sales_amount_clp_period == 180000
    # Baseline disponible; el historial corto no habilita una decisión de stock.
    assert aurora.forecast_units_total is not None and aurora.forecast_units_total > 0
    assert aurora.coverage_weeks == pytest.approx(2.29)
    assert aurora.suggested_units is None
    assert aurora.risk == "insufficient_data"
    assert "28 días" in aurora.reason


def test_horizon_rechazado_en_connected(connected) -> None:
    from app.services.exceptions import BusinessValidationError

    with pytest.raises(BusinessValidationError):
        connected.list_variants(None, None, None, None, None, 25, 1, 200)


def test_recommendations_short_history_requires_review(connected) -> None:
    rows, pagination = connected.get_recommendations(None, None, None, None, 1, 50)
    assert pagination.total == 3
    assert {item.risk for item in rows} == {"insufficient_data"}
    assert {item.action for item in rows} == {"review_data"}


def test_forecasts_historial_real_y_baseline(connected) -> None:
    serie = connected.get_forecasts("p101-38", None, None, None)
    assert [sp.period_start for sp in serie.history] == ["2026-10-02"]
    assert serie.history[0].units_sold == 3
    assert len(serie.forecast) == 4
    assert all(point.method == "baseline" for point in serie.forecast)
    assert serie.forecast[0].period_start == "2026-10-06"


def test_catalog_without_sales_has_no_forecast_points() -> None:
    class EmptySalesSnapshot:
        productos = PRODUCTOS
        stock = STOCK
        lineas: list[dict] = []
        conteos: dict[str, int] = {}

        def ensure_fresh(self) -> None:
            return None

    service = AnalyticsServiceConnected(EmptySalesSnapshot())
    rows, _ = service.list_variants(None, None, None, None, None, None, 1, 200)

    assert all(row.forecast_units_total is None for row in rows)
    assert all(row.risk == "insufficient_data" for row in rows)
    assert service.get_data_status().metadata.forecast_method is None


def test_croston_sba_handles_intermittent_sales() -> None:
    estimate = croston_sba_weekly([1, 0, 0, 1, 0, 0, 1])
    assert estimate == pytest.approx(3.66, abs=0.02)


def test_stockout_recommendation_requires_sufficient_history(connected) -> None:
    connected.settings = Settings(
        app_mode="connected",
        supplier_lead_time_weeks=2,
    )
    recommendation = connected._recommendation_for(
        connected._by_id["p101-40"],
        weekly_demand=1.5,
        history_days=28,
        active_days=4,
    )
    assert recommendation.risk == "stockout"
    assert recommendation.action == "replenish"
    assert recommendation.suggested_units == 6


def test_variante_desconocida_404(connected) -> None:
    from app.services.exceptions import NotFoundVariantError

    with pytest.raises(NotFoundVariantError):
        connected.get_variant("p999-42")


def test_estado_de_datos_conectado(connected) -> None:
    status = connected.get_data_status()
    md = status.metadata
    assert md.data_source == "supabase"
    assert md.data_mode == "connected"
    assert md.forecast_method == "baseline"
    assert md.historical_range is not None and md.historical_range.start == "2026-10-02"
    assert md.forecast_range is not None
    assert md.forecast_range.start == "2026-10-06"
    assert status.fixture_available is False


# ── Router integrado en modo connected (sin dotenv real) ────────────────


def test_router_connected_endpoints(monkeypatch) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/productos"):
            return httpx.Response(200, headers={"Content-Range": "0-1/2"}, json=PRODUCTOS)
        if path.endswith("/stock"):
            return httpx.Response(200, headers={"Content-Range": "0-2/3"}, json=STOCK)
        if path.endswith("/detalles_pedido"):
            return httpx.Response(200, headers={"Content-Range": "0-2/3"}, json=VENTAS)
        if path.endswith("/pedidos"):
            params = dict(request.url.params)
            data = PEDIDOS_MINMAX[0] if "asc" in params.get("order", "") else PEDIDOS_MINMAX[1]
            return httpx.Response(200, headers={"Content-Range": "0-0/2"}, json=[data])
        return httpx.Response(200, headers={"Content-Range": "*/0"}, json=[])

    settings = Settings(
        app_mode="connected",
        supabase_url="https://proyecto-demo.supabase.co",
        supabase_publishable_key="clave-publica-de-prueba",
        supabase_secret_key="",
    )
    monkeypatch.setattr(config_module, "get_settings", lambda: settings)
    import app.api.v1.router as router_module

    def unexpected_fixture_read() -> None:
        raise AssertionError("connected mode must not load the demo fixture")

    monkeypatch.setattr(router_module, "get_repository", unexpected_fixture_read)
    # Inyección del snapshot simulado para que el router NO toque la red real:
    import app.repositories.supabase_rest as supabase_rest_module

    snapshot_prueba = ConnectedSnapshot(make_repo(handler), ttl_seconds=60)
    monkeypatch.setattr(
        supabase_rest_module, "get_connected_repo", lambda: snapshot_prueba
    )
    reset_connected_cache()
    refresh_calls: list[bool] = []
    monkeypatch.setattr(
        supabase_rest_module,
        "reset_connected_cache",
        lambda: refresh_calls.append(True),
    )

    from app.main import create_app

    api = TestClient(create_app())

    health = api.get("/health")
    assert health.status_code == 200
    assert health.json()["mode"] == "connected"

    overview = api.get("/api/v1/overview")
    assert overview.status_code == 200
    body = overview.json()
    assert body["meta"] == {"mode": "connected"}  # etiqueta honesta del modo
    assert body["data"]["units_sold"] == 4

    forecasts = api.get("/api/v1/forecasts", params={"variant_id": "p101-38"})
    assert forecasts.status_code == 200
    assert len(forecasts.json()["data"]["forecast"]) == 4
    assert forecasts.json()["data"]["forecast"][0]["method"] == "baseline"

    refreshed_status = api.get("/api/v1/data-status", params={"refresh": "true"})
    assert refreshed_status.status_code == 200
    assert refresh_calls == [True]

    horizon_error = api.get("/api/v1/variants", params={"horizon_weeks": 25})
    assert horizon_error.status_code == 422
    assert horizon_error.json()["error"]["code"] == "VALIDATION_ERROR"

    reset_connected_cache()
