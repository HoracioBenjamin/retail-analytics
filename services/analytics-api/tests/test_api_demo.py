"""Pruebas de la API demo (Entrega B): contrato completo y números conocidos.

Los valores afirmados salen del dataset determinista canónico
fixtures/demo-v1.json (semilla 20260928, demo-v1.0.0):
- 40 variantes (4 modelos × 2 colores × 5 tallas EU)
- Resumen "todo el histórico": 2 240 unidades · 177 272 600 CLP
- Recomendaciones: replenish 3 · maintain 16 · defer_purchase 11 ·
  review_data 10
- Horizonte máximo de pronóstico: 4 semanas
"""

from __future__ import annotations

from fastapi.testclient import TestClient

# ── /health ─────────────────────────────────────────────────────────────


def test_health_ok_y_modo_demo(api: TestClient) -> None:
    res = api.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["mode"] == "demo-api"
    assert body["dataset_available"] is True
    assert body["dataset_version"] == "demo-v1.0.0"
    assert body["dataset_as_of"] == "2026-09-28"


# ── /api/v1/data-status ─────────────────────────────────────────────────


def test_data_status_metadata_completa(api: TestClient) -> None:
    res = api.get("/api/v1/data-status")
    assert res.status_code == 200
    payload = res.json()
    assert payload["meta"] == {"mode": "demo-api"}
    md = payload["data"]["metadata"]
    assert md["data_source"] == "demo"
    assert md["data_mode"] == "demo-api"
    assert md["as_of"] == "2026-09-28"
    assert md["historical_range"]["start"] == "2026-07-06"
    assert md["forecast_method"] == "fixture"
    assert md["dataset_version"] == "demo-v1.0.0"
    assert len(md["limitations"]) >= 1
    assert "sin modelo entrenado" in md["limitations"][0]


# ── /api/v1/filters ─────────────────────────────────────────────────────


def test_filters_disponibles(api: TestClient) -> None:
    res = api.get("/api/v1/filters")
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data["models"]) == 4
    assert len(data["colors"]) == 2
    assert len(data["sizes"]) == 5
    assert "Aurora Running" in data["models"]


# ── /api/v1/overview ────────────────────────────────────────────────────


def test_overview_histograma_completo(api: TestClient) -> None:
    res = api.get("/api/v1/overview")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["period_start"] == "2026-07-06"
    assert data["period_end"] == "2026-09-27"
    assert data["units_sold"] == 2240
    assert data["sales_amount_clp"] == 177_272_600
    assert data["variants_total"] == 40
    assert data["variants_at_risk"] == 14
    assert data["risk_counts"]["stockout"] == 3
    assert data["risk_counts"]["excess"] == 11


def test_overview_filtro_por_modelo(api: TestClient) -> None:
    res = api.get("/api/v1/overview", params={"model": "Aurora Running"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["variants_total"] == 10
    assert data["units_sold"] < 2240  # coherente: subconjunto


# ── /api/v1/variants ────────────────────────────────────────────────────


def test_variants_paginacion_y_campos(api: TestClient) -> None:
    res = api.get("/api/v1/variants", params={"page": 1, "page_size": 10})
    assert res.status_code == 200
    payload = res.json()
    assert payload["pagination"] == {"page": 1, "page_size": 10, "total": 40}
    assert len(payload["data"]) == 10
    row = payload["data"][0]
    for campo in (
        "variant_id",
        "model",
        "stock_on_hand",
        "units_sold_period",
        "forecast_units_total",
        "coverage_weeks",
        "risk",
        "action",
    ):
        assert campo in row


def test_variants_horizon_invalido_422(api: TestClient) -> None:
    res = api.get("/api/v1/variants", params={"horizon_weeks": 9})
    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "VALIDATION_ERROR"
    assert "horizon_weeks" in error["message"]


def test_variants_fecha_mal_formada_422(api: TestClient) -> None:
    res = api.get("/api/v1/overview", params={"date_from": "06/07/2026"})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


# ── /api/v1/variants/{id} ───────────────────────────────────────────────


def test_variants_detalle_404(api: TestClient) -> None:
    res = api.get("/api/v1/variants/variante-fantasma")
    assert res.status_code == 404
    error = res.json()["error"]
    assert error["code"] == "NOT_FOUND"
    assert "Variante desconocida" in error["message"]


def test_variants_detalle_contenido(api: TestClient) -> None:
    res = api.get("/api/v1/variants/aurora-blanco-40")
    assert res.status_code == 200
    data = res.json()["data"]
    assert data["variant"]["variant_id"] == "aurora-blanco-40"
    assert len(data["sales_history"]) == 12
    assert len(data["forecast"]) == 4
    recommendation = data["recommendation"]
    assert recommendation["action"] in {"replenish", "maintain", "defer_purchase", "review_data"}
    assert recommendation["risk"] in {"stockout", "excess", "balanced", "insufficient_data"}


# ── /api/v1/forecasts ───────────────────────────────────────────────────


def test_forecasts_requiere_variant_id(api: TestClient) -> None:
    res = api.get("/api/v1/forecasts")
    assert res.status_code == 422


def test_forecasts_serie_completa(api: TestClient) -> None:
    res = api.get("/api/v1/forecasts", params={"variant_id": "aurora-blanco-40"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert len(data["history"]) == 12
    assert len(data["forecast"]) == 4
    punto = data["forecast"][0]
    assert punto["method"] == "fixture"
    assert punto["model_version"] is None


def test_forecasts_horizonte_limitado(api: TestClient) -> None:
    res = api.get(
        "/api/v1/forecasts",
        params={"variant_id": "aurora-blanco-40", "horizon_weeks": 2},
    )
    assert res.status_code == 200
    assert len(res.json()["data"]["forecast"]) == 2


# ── /api/v1/recommendations ─────────────────────────────────────────────


def test_recommendations_composicion_del_fixture(api: TestClient) -> None:
    res = api.get("/api/v1/recommendations", params={"page_size": 200})
    assert res.status_code == 200
    payload = res.json()
    assert payload["pagination"]["total"] == 40
    actions = [r["action"] for r in payload["data"]]
    assert actions.count("replenish") == 3
    assert actions.count("maintain") == 16
    assert actions.count("defer_purchase") == 11
    assert actions.count("review_data") == 10


def test_recommendations_orden_reponer_primero(api: TestClient) -> None:
    res = api.get("/api/v1/recommendations", params={"page_size": 200})
    actions = [r["action"] for r in res.json()["data"]]
    first_replenish_index = actions.index("replenish")
    first_maintain_index = actions.index("maintain")
    assert first_replenish_index < first_maintain_index


def test_recommendations_filtro_por_riesgo(api: TestClient) -> None:
    res = api.get("/api/v1/recommendations", params={"risk": "stockout"})
    assert res.status_code == 200
    data = res.json()["data"]
    assert res.json()["pagination"]["total"] == 3
    assert all(r["risk"] == "stockout" for r in data)
