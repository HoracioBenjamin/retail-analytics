"""Servicio analítico en modo `connected` (etapa C) sobre Supabase REST.

Replica la INTERFAZ pública de `AnalyticsService` con los mismos modelos
de salida, pero los datos salen de la base real (solo lectura):

- Venta confirmada = `pedidos.estado = 'exitoso'` (docs/CONSULTAS_SUPABASE.md §1).
- Inventario = `stock.cantidad` por producto × talla.
- NO hay proyecciones ni recomendaciones: rótulos "Modelo predictivo
  pendiente" — nada se inventa (sin suggested_units, coverage, risk real).
- Los KPIs se agregan en Python (PostgREST no tiene GROUP BY agregable y
  no se crean funciones/vistas en la base).

Las fechas de venta derivan de `pedidos.created_at` (ISO → 'YYYY-MM-DD'):
cada día es un `SalesPoint` con period_start = period_end.
"""

from __future__ import annotations

from collections import defaultdict

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
from app.services.analytics_service import _collation_key
from app.services.exceptions import BusinessValidationError, NotFoundVariantError

# Etiquetas de estado sin modelo (se muestran tal cual en la UI):
NOT_MODEL_REASON = "Requiere modelo predictivo: etapa pendiente, sin cálculos inventados."


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
            day = _date(ped.get("created_at"))
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
            forecast_range=None,
            # Sin modelo: null honesto — UI pinta "Modelo predictivo pendiente".
            forecast_method=None,
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
                    "SIN modelo entrenado: no hay proyecciones ni recomendaciones "
                    "(etapa ML del equipo de práctica)."
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
        return Overview(
            period_start=start,
            period_end=end,
            units_sold=units,
            sales_amount_clp=amount,
            variants_total=len(in_range),
            # Sin recomendaciones reales: nadie "en riesgo" affirmable todavía;
            # todas las variantes quedan en el bucket insuficiente.
            variants_at_risk=0,
            risk_counts={
                "stockout": 0, "excess": 0, "balanced": 0,
                "insufficient_data": len(in_range),
            },
        )

    # ── GET /api/v1/variants ──

    def list_variants(
        self,
        date_from: str | None, date_to: str | None,
        model: str | None, color: str | None, size: str | None,
        horizon_weeks: int | None,
        page: int, page_size: int,
    ) -> tuple[list[VariantRow], Pagination]:
        if horizon_weeks is not None:
            raise BusinessValidationError(
                "No hay proyecciones todavía (modelo predictivo pendiente): "
                "horizon_weeks no está disponible en modo connected."
            )
        start, end = self._effective_range(date_from, date_to)
        rows: list[VariantRow] = []
        for v in self._variants_for(model, color, size):
            units_period = 0
            amount_period = 0
            for sp in self.history_by_variant.get(v.variant_id, []):
                if start <= sp.period_start <= end:
                    units_period += sp.units_sold
                    amount_period += sp.sales_amount_clp
            rows.append(
                VariantRow(
                    **v.model_dump(),
                    units_sold_period=units_period,
                    sales_amount_clp_period=amount_period,
                    forecast_units_total=None,
                    coverage_weeks=None,
                    risk="insufficient_data",
                    action="review_data",
                    suggested_units=None,
                    reason=NOT_MODEL_REASON,
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
            recommendation=None,
            forecast=[],
        )

    # ── GET /api/v1/forecasts ──

    def get_forecasts(
        self, variant_id: str,
        date_from: str | None, date_to: str | None,
        horizon_weeks: int | None,
    ) -> ForecastSeries:
        if variant_id not in self._by_id:
            raise NotFoundVariantError(variant_id)
        if horizon_weeks is not None:
            raise BusinessValidationError(
                "No hay proyecciones todavía (modelo predictivo pendiente): "
                "horizon_weeks no está disponible en modo connected."
            )
        start, end = self._effective_range(date_from, date_to)
        history = [
            sp for sp in self.history_by_variant.get(variant_id, [])
            if start <= sp.period_start <= end
        ]
        return ForecastSeries(history=history, forecast=[])

    # ── GET /api/v1/recommendations ──

    def get_recommendations(  # noqa: PLR0913
        self, model: str | None, color: str | None, size: str | None,
        risk: str | None, page: int, page_size: int,
    ) -> tuple[list[Recommendation], Pagination]:
        # Sin modelo: NINGUNA recomendación real; lista vacía honesta.
        # La pantalla muestra "Requiere modelo predictivo".
        _ = (model, color, size, risk)
        return [], Pagination(page=page, page_size=page_size, total=0)
