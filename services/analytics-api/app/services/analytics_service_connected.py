"""Servicio analítico en modo `connected` (etapa C) sobre Supabase REST.

Replica la INTERFAZ pública de `AnalyticsService` con los mismos modelos
de salida, pero los datos salen de la base real (solo lectura):

- Venta confirmada = `pedidos.estado = 'exitoso'` (docs/CONSULTAS_SUPABASE.md §1).
- Inventario = `stock.cantidad` por producto × talla.
- Pronóstico Croston-SBA baseline para demanda intermitente; no es un modelo
    supervisado entrenado ni tiene métricas de precisión validadas.
- Riesgo y cantidades sugeridas requieren historia suficiente y plazo real
    de proveedor; si faltan, se devuelve `review_data` sin sugerir compras.
- Los KPIs se agregan en Python (PostgREST no tiene GROUP BY agregable y
  no se crean funciones/vistas en la base).

Las fechas de venta derivan de `pedidos.created_at` (ISO → 'YYYY-MM-DD'):
cada día es un `SalesPoint` con period_start = period_end.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from math import ceil

from app.core.config import get_settings
from app.repositories.supabase_rest import ConnectedSnapshot
from app.schemas.domain import (
    DataMetadata,
    DataStatus,
    FilterAvailability,
    ForecastSeries,
    Overview,
    Pagination,
    PeriodRange,
    Recommendation,
    SalesPoint,
    Variant,
    VariantDetail,
    VariantRow,
)
from app.services.analytics_service import ACTION_PRIORITY, _collation_key
from app.services.exceptions import BusinessValidationError, NotFoundVariantError
from app.services.forecasting import (
    EXCESS_THRESHOLD_WEEKS,
    FORECAST_HORIZON_WEEKS,
    MIN_HISTORY_DAYS,
    croston_sba_weekly,
    forecast_points,
)

REVIEW_PERIOD_WEEKS = 1.0
SAFETY_STOCK_WEEKS = 1.0


def _date(iso: str | None) -> str | None:
    """'2026-10-01T12:34:56+00:00' → '2026-10-01' (día calendario)."""
    return iso[:10] if iso else None


class AnalyticsServiceConnected:
    def __init__(self, snapshot: ConnectedSnapshot) -> None:
        self.snapshot = snapshot
        snapshot.ensure_fresh()

        # ── Catálogo: producto × talla = variante ──────────────────────────
        self.variants: list[Variant] = []
        self._by_id: dict[str, Variant] = {}
        for p in snapshot.productos:
            brand = (p.get("marcas") or {}).get("nombre") or "s/d"
            color = (p.get("colores") or {}).get("nombre") or "s/d"
            stock_rows = [
                s for s in snapshot.stock
                if str(s.get("producto_id")) == str(p["id"])
            ]
            if not stock_rows:
                continue  # producto sin filas de stock: sin variante inventada
            for s in stock_rows:
                size = str(s.get("talla", "")).strip()
                if not size:
                    continue
                variant = Variant(
                    variant_id=f"p{p['id']}-{size}",
                    product_id=str(p["id"]),
                    sku=None,
                    model=str(p["nombre"]),
                    brand=brand,
                    color=color,
                    size=size,
                    # La tienda no registra sistema de talla: no se inventa.
                    size_system="s/d",
                    stock_on_hand=int(s.get("cantidad") or 0),
                )
                self.variants.append(variant)
                self._by_id[variant.variant_id] = variant
        self.variants.sort(key=lambda v: (
            _collation_key(v.model), _collation_key(v.color), _collation_key(v.size)
        ))

        # ── Ventas confirmadas por variante ────────────────────────────────
        self.history_by_variant: dict[str, list[SalesPoint]] = defaultdict(list)
        dates: list[str] = []
        for line in snapshot.lineas:
            ped = line.get("pedidos") or {}
            # Doble verificación de la regla de negocio (docs §1):
            # la consulta REST ya filtra pedidos.estado=eq.exitoso; se revalida
            # en Python por seguridad (nunca sumar ventas no confirmadas).
            if str(ped.get("estado")) != "exitoso":
                continue
            # Fecha de venta = pago real si la tienda la registró
            # (pedidos.fecha_pago, columna agregada 2026-10); si es NULL
            # (webhook antiguo/test), fallback honesto a created_at.
            day = _date(ped.get("fecha_pago") or ped.get("created_at"))
            if not day:
                continue  # pedido sin fecha: fila ignorada, cota documentada
            variant_id = f"p{line['producto_id']}-{str(line.get('talla','')).strip()}"
            if variant_id not in self._by_id:
                continue  # venta de producto/talla fuera del catálogo actual
            date_iso = day
            units = int(line.get("cantidad") or 0)
            amount = int(line.get("cantidad") or 0) * int(line.get("precio_unitario") or 0)
            self.history_by_variant[variant_id].append(
                SalesPoint(
                    variant_id=variant_id,
                    period_start=date_iso,
                    period_end=date_iso,
                    units_sold=units,
                    sales_amount_clp=amount,
                    # La venta confirmada implica disponibilidad al venderse:
                    availability_status="available",
                )
            )
            dates.append(date_iso)
        for series in self.history_by_variant.values():
            series.sort(key=lambda sp: sp.period_start)
        self.hist_start = min(dates) if dates else None
        self.hist_end = max(dates) if dates else None

        self.settings = get_settings()
        self.forecasts_by_variant: dict[str, list] = {}
        self.recommendations_by_variant: dict[str, Recommendation] = {}
        self.weekly_demand_by_variant: dict[str, float] = {}
        if self.hist_start and self.hist_end:
            first_day = date.fromisoformat(self.hist_start)
            last_day = date.fromisoformat(self.hist_end)
            history_days = (last_day - first_day).days + 1
            sales_by_variant_day: dict[str, dict[str, int]] = defaultdict(
                lambda: defaultdict(int)
            )
            for variant_id, series in self.history_by_variant.items():
                for point in series:
                    sales_by_variant_day[variant_id][point.period_start] += point.units_sold

            for variant in self.variants:
                daily_units = [
                    sales_by_variant_day[variant.variant_id].get(
                        (first_day + timedelta(days=offset)).isoformat(), 0
                    )
                    for offset in range(history_days)
                ]
                weekly_demand = croston_sba_weekly(daily_units)
                self.weekly_demand_by_variant[variant.variant_id] = weekly_demand
                self.forecasts_by_variant[variant.variant_id] = (
                    forecast_points(variant.variant_id, weekly_demand, self.hist_end)
                    if weekly_demand > 0
                    else []
                )
                active_days = sum(units > 0 for units in daily_units)
                self.recommendations_by_variant[variant.variant_id] = (
                    self._recommendation_for(
                        variant,
                        weekly_demand,
                        history_days,
                        active_days,
                    )
                )

        for variant in self.variants:
            self.recommendations_by_variant.setdefault(
                variant.variant_id,
                self._recommendation_for(variant, 0.0, 0, 0),
            )

        all_forecasts = [
            point
            for series in self.forecasts_by_variant.values()
            for point in series
        ]
        self.forecast_start = min(
            (point.period_start for point in all_forecasts), default=None
        )
        self.forecast_end = max(
            (point.period_end for point in all_forecasts), default=None
        )

    def _recommendation_for(
        self,
        variant: Variant,
        weekly_demand: float,
        history_days: int,
        active_days: int,
    ) -> Recommendation:
        coverage = (
            variant.stock_on_hand / weekly_demand if weekly_demand > 0 else None
        )
        if history_days < MIN_HISTORY_DAYS or active_days < 2 or weekly_demand <= 0:
            return Recommendation(
                variant_id=variant.variant_id,
                action="review_data",
                suggested_units=None,
                coverage_weeks=round(coverage, 2) if coverage is not None else None,
                risk="insufficient_data",
                reason=(
                    f"Baseline Croston-SBA disponible, pero se requieren al menos "
                    f"{MIN_HISTORY_DAYS} días y ventas en varios días para clasificar riesgo. "
                    f"Histórico actual: {history_days} días."
                ),
            )

        assert coverage is not None
        lead_time = self.settings.supplier_lead_time_weeks
        if coverage > EXCESS_THRESHOLD_WEEKS:
            return Recommendation(
                variant_id=variant.variant_id,
                action="defer_purchase",
                suggested_units=0,
                coverage_weeks=round(coverage, 2),
                risk="excess",
                reason=(
                    f"Cobertura estimada de {coverage:.1f} semanas, sobre el umbral "
                    f"configurado de {EXCESS_THRESHOLD_WEEKS:.0f} semanas."
                ),
            )

        if lead_time is None:
            return Recommendation(
                variant_id=variant.variant_id,
                action="review_data",
                suggested_units=None,
                coverage_weeks=round(coverage, 2),
                risk="insufficient_data",
                reason=(
                    "Configura SUPPLIER_LEAD_TIME_WEEKS con el plazo real del proveedor "
                    "para evaluar riesgo de agotamiento."
                ),
            )

        target_coverage = lead_time + REVIEW_PERIOD_WEEKS + SAFETY_STOCK_WEEKS
        demand_weeks_used = ceil(history_days / 7)
        parameters = {
            "lead_time_weeks": lead_time,
            "review_period_weeks": REVIEW_PERIOD_WEEKS,
            "safety_stock_weeks": SAFETY_STOCK_WEEKS,
            "coverage_period_weeks": target_coverage,
            "excess_threshold_weeks": EXCESS_THRESHOLD_WEEKS,
            "stockout_threshold_weeks": lead_time + SAFETY_STOCK_WEEKS,
            "demand_weeks_used": demand_weeks_used,
            "units_in_transit": 0,
        }
        if coverage < lead_time + SAFETY_STOCK_WEEKS:
            suggested_units = max(
                0, ceil(weekly_demand * target_coverage - variant.stock_on_hand)
            )
            return Recommendation(
                variant_id=variant.variant_id,
                action="replenish",
                suggested_units=suggested_units,
                coverage_weeks=round(coverage, 2),
                risk="stockout",
                reason=(
                    f"Cobertura estimada de {coverage:.1f} semanas, bajo el plazo "
                    f"de proveedor más stock de seguridad ({lead_time + SAFETY_STOCK_WEEKS:.1f})."
                ),
                parameters=parameters,
            )

        return Recommendation(
            variant_id=variant.variant_id,
            action="maintain",
            suggested_units=0,
            coverage_weeks=round(coverage, 2),
            risk="balanced",
            reason="La cobertura estimada está dentro de los umbrales configurados.",
            parameters=parameters,
        )

    # ── helpers ─────────────────────────────────────────────────────────────

    def _effective_range(self, date_from: str | None, date_to: str | None) -> tuple[str, str]:
        return date_from or self.hist_start, date_to or self.hist_end

    def _matches(self, v: Variant, model: str | None, color: str | None, size: str | None) -> bool:
        eq = lambda a, b: b is None or a.casefold() == b.casefold()  # noqa: E731
        return eq(v.model, model) and eq(v.color, color) and eq(v.size, size)

    def _variants_for(
        self, model: str | None, color: str | None, size: str | None
    ) -> list[Variant]:
        return [v for v in self.variants if self._matches(v, model, color, size)]

    # ── GET /health ──

    def health_payload(self) -> dict:
        from app.core.config import get_settings

        return {
            "ok": True,
            "service": "zapatillas-duoc-analytics-api",
            "mode": "connected",
            "app_env": get_settings().app_env,
            "upstream": "supabase-rest (clave pública, solo SELECT, RLS)",
            "dataset_available": bool(self.variants),
            "conteos": self.snapshot.conteos,
        }

    # ── GET /api/v1/data-status ──

    def get_data_status(self) -> DataStatus:
        return DataStatus(
            metadata=self._metadata(),
            fixture_available=False,
        )

    def _metadata(self) -> DataMetadata:
        return DataMetadata(
            data_source="supabase",
            data_mode="connected",
            as_of=self.hist_end,
            historical_range=(
                PeriodRange(start=self.hist_start, end=self.hist_end)
                if self.hist_start else None
            ),
            forecast_range=(
                PeriodRange(start=self.forecast_start, end=self.forecast_end)
                if self.forecast_start else None
            ),
            forecast_method="baseline" if self.forecast_start else None,
            limitations=[
                (
                    "Conexión en vivo a Supabase, SOLO lectura, con clave pública "
                    "anon: las políticas RLS existentes definen lo accesible."
                ),
                (
                    "Venta confirmada = pedidos.estado 'exitoso'. Montos = "
                    "cantidad × precio_unitario (CLP)."
                ),
                (
                    "Pronóstico baseline Croston-SBA para demanda intermitente; no es un "
                    "modelo supervisado entrenado y no tiene métricas de precisión validadas."
                ),
                (
                    f"Se requieren {MIN_HISTORY_DAYS} días observados para recomendaciones "
                    "de riesgo; el plazo del proveedor debe configurarse en "
                    "SUPPLIER_LEAD_TIME_WEEKS."
                ),
                (
                    "Unidades en tránsito: no existen en el esquema (tratadas 0); "
                    "talla como texto libre, sin sistema de talla registrado."
                ),
            ],
            dataset_version=None,
        )

    # ── GET /api/v1/filters ──

    def get_filters(self) -> FilterAvailability:
        def uniq_sorted(values: list[str]) -> list[str]:
            return sorted(set(values), key=_collation_key)

        return FilterAvailability(
            models=uniq_sorted([v.model for v in self.variants]),
            colors=uniq_sorted([v.color for v in self.variants]),
            sizes=uniq_sorted([v.size for v in self.variants]),
        )

    # ── GET /api/v1/overview ──

    def get_overview(
        self, date_from: str | None, date_to: str | None,
        model: str | None, color: str | None, size: str | None,
    ) -> Overview:
        start, end = self._effective_range(date_from, date_to)
        in_range = self._variants_for(model, color, size)
        ids = {v.variant_id for v in in_range}
        units = 0
        amount = 0
        for variant_id in ids:
            for sp in self.history_by_variant.get(variant_id, []):
                if start <= sp.period_start <= end:
                    units += sp.units_sold
                    amount += sp.sales_amount_clp
        risk_counts = {
            "stockout": 0,
            "excess": 0,
            "balanced": 0,
            "insufficient_data": 0,
        }
        for variant_id in ids:
            recommendation = self.recommendations_by_variant.get(variant_id)
            if recommendation:
                risk_counts[recommendation.risk] += 1

        return Overview(
            period_start=start,
            period_end=end,
            units_sold=units,
            sales_amount_clp=amount,
            variants_total=len(in_range),
            variants_at_risk=risk_counts["stockout"] + risk_counts["excess"],
            risk_counts=risk_counts,
        )

    # ── GET /api/v1/variants ──

    def list_variants(
        self,
        date_from: str | None, date_to: str | None,
        model: str | None, color: str | None, size: str | None,
        horizon_weeks: int | None,
        page: int, page_size: int,
    ) -> tuple[list[VariantRow], Pagination]:
        horizon = horizon_weeks or FORECAST_HORIZON_WEEKS
        if horizon > 24:
            raise BusinessValidationError("horizon_weeks admite como máximo 24 semanas.")
        start, end = self._effective_range(date_from, date_to)
        rows: list[VariantRow] = []
        for v in self._variants_for(model, color, size):
            units_period = 0
            amount_period = 0
            for sp in self.history_by_variant.get(v.variant_id, []):
                if start <= sp.period_start <= end:
                    units_period += sp.units_sold
                    amount_period += sp.sales_amount_clp
            forecast = self.forecasts_by_variant.get(v.variant_id, [])[:horizon]
            recommendation = self.recommendations_by_variant[v.variant_id]
            rows.append(
                VariantRow(
                    **v.model_dump(),
                    units_sold_period=units_period,
                    sales_amount_clp_period=amount_period,
                    forecast_units_total=(
                        sum(point.predicted_units for point in forecast) if forecast else None
                    ),
                    coverage_weeks=recommendation.coverage_weeks,
                    risk=recommendation.risk,
                    action=recommendation.action,
                    suggested_units=recommendation.suggested_units,
                    reason=recommendation.reason,
                )
            )
        total = len(rows)
        return (
            rows[(page - 1) * page_size : page * page_size],
            Pagination(page=page, page_size=page_size, total=total),
        )

    # ── GET /api/v1/variants/{id} ──

    def get_variant(self, variant_id: str) -> VariantDetail:
        variant = self._by_id.get(variant_id)
        if variant is None:
            raise NotFoundVariantError(variant_id)
        return VariantDetail(
            variant=variant,
            sales_history=self.history_by_variant.get(variant_id, []),
            recommendation=self.recommendations_by_variant.get(variant_id),
            forecast=self.forecasts_by_variant.get(variant_id, []),
        )

    # ── GET /api/v1/forecasts ──

    def get_forecasts(
        self, variant_id: str,
        date_from: str | None, date_to: str | None,
        horizon_weeks: int | None,
    ) -> ForecastSeries:
        if variant_id not in self._by_id:
            raise NotFoundVariantError(variant_id)
        horizon = horizon_weeks or FORECAST_HORIZON_WEEKS
        if horizon > 24:
            raise BusinessValidationError("horizon_weeks admite como máximo 24 semanas.")
        start, end = self._effective_range(date_from, date_to)
        history = [
            sp for sp in self.history_by_variant.get(variant_id, [])
            if start <= sp.period_start <= end
        ]
        return ForecastSeries(
            history=history,
            forecast=self.forecasts_by_variant.get(variant_id, [])[:horizon],
        )

    # ── GET /api/v1/recommendations ──

    def get_recommendations(  # noqa: PLR0913
        self, model: str | None, color: str | None, size: str | None,
        risk: str | None, page: int, page_size: int,
    ) -> tuple[list[Recommendation], Pagination]:
        selected = [
            recommendation
            for variant in self._variants_for(model, color, size)
            if (recommendation := self.recommendations_by_variant.get(variant.variant_id))
            and (risk is None or recommendation.risk == risk)
        ]
        selected.sort(
            key=lambda item: (ACTION_PRIORITY[item.action], _collation_key(item.variant_id))
        )
        total = len(selected)
        page_items = selected[(page - 1) * page_size : page * page_size]
        return page_items, Pagination(page=page, page_size=page_size, total=total)
