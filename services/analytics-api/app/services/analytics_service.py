"""Lógica de negocio de la API demo — espejo del proveedor demo-local.

Las agregaciones (KPIs, cobertura, filtros, orden) replican exactamente
`DemoLocalProvider` del escritorio para que ambos modos produzcan
resultados equivalentes con el mismo fixture (Paso 7, punto 3 del plan).
"""

import re
import unicodedata

from app.repositories.fixture_repository import FixtureRepository
from app.schemas.domain import (
    DataMetadata,
    DataStatus,
    FilterAvailability,
    ForecastPoint,
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
from app.services.exceptions import BusinessValidationError, NotFoundVariantError

ACTION_PRIORITY = {
    "replenish": 0,
    "defer_purchase": 1,
    "review_data": 2,
    "maintain": 3,
}


def _collation_key(value: str) -> tuple:
    """Clave de orden compatible con `Intl.Collator('es', {numeric: true})`:
    ignora acentos y ORDINA NUMÉRICAMENTE los segmentos de dígitos.
    """
    plain = unicodedata.normalize("NFD", value)
    plain = "".join(c for c in plain if unicodedata.category(c) != "Mn").casefold()
    return tuple(
        (1, int(seg), "") if seg.isdigit() else (0, 0, seg)
        for seg in re.split(r"(\d+)", plain)
        if seg != ""
    )


def _matches_filters(v: Variant, model: str | None, color: str | None, size: str | None) -> bool:
    eq = lambda a, b: b is None or a.casefold() == b.casefold()  # noqa: E731
    return eq(v.model, model) and eq(v.color, color) and eq(v.size, size)


def _overlaps(point: SalesPoint | ForecastPoint, date_from: str, date_to: str) -> bool:
    return point.period_end >= date_from and point.period_start <= date_to


# ── Servicio ────────────────────────────────────────────────────────────


class AnalyticsService:
    def __init__(self, repo: FixtureRepository) -> None:
        self.repo = repo
        # El dataset se validó en el repositorio; aquí se indexan extremos.
        self._hist_start = min((p.period_start for p in repo.sales_history), default=None)
        self._hist_end = max((p.period_end for p in repo.sales_history), default=None)
        self._fc_start = min((p.period_start for p in repo.forecasts), default=None)
        self._fc_end = max((p.period_end for p in repo.forecasts), default=None)

    # ── helpers ──

    def _effective_range(self, date_from: str | None, date_to: str | None) -> tuple[str, str]:
        return date_from or self._hist_start, date_to or self._hist_end

    def _matching_variants(
        self, model: str | None, color: str | None, size: str | None
    ) -> list[Variant]:
        out = [v for v in self.repo.variants if _matches_filters(v, model, color, size)]
        out.sort(
            key=lambda v: (
                _collation_key(v.model),
                _collation_key(v.color),
                _collation_key(v.size),
            )
        )
        return out

    def _variant_by_id(self, variant_id: str) -> Variant:
        for v in self.repo.variants:
            if v.variant_id == variant_id:
                return v
        raise NotFoundVariantError(variant_id)

    # ── GET /health ──

    def health_payload(self) -> dict:
        from app.core.config import get_settings

        settings = get_settings()
        return {
            "ok": True,
            "service": "zapatillas-duoc-analytics-api",
            "mode": "demo-api",
            "app_env": settings.app_env,
            "dataset_available": bool(self.repo.variants),
            "dataset_version": self.repo.dataset_version if self.repo.variants else None,
            "dataset_as_of": self.repo.as_of if self.repo.variants else None,
        }

    # ── GET /api/v1/data-status ──

    def get_data_status(self) -> DataStatus:
        if not self.repo.variants:
            raise BusinessValidationError("Dataset de demostración no disponible.")
        return DataStatus(
            metadata=self._metadata(),
            fixture_available=True,
        )

    def _metadata(self) -> DataMetadata:
        d = self.repo
        return DataMetadata(
            data_source="demo",
            data_mode="demo-api",
            as_of=d.as_of,
            historical_range=PeriodRange(start=self._hist_start, end=self._hist_end),
            forecast_range=PeriodRange(start=self._fc_start, end=self._fc_end),
            forecast_method="fixture",
            limitations=[
                (
                    f"Dataset de demostración determinista {d.dataset_version} "
                    f"(generado {d.generated}); sin modelo entrenado."
                ),
                (
                    f"Los valores futuros ({d.forecast_weeks} semanas) son ilustrativos, "
                    'method "fixture", model_version null.'
                ),
                (
                    "Alcance del período de cobertura: plazo de proveedor + frecuencia de "
                    "revisión; reglas ilustrativas de la base, no un motor de decisión."
                ),
                "La versión conectada (Supabase) no está disponible en las entregas A y B.",
            ],
            dataset_version=d.dataset_version,
        )

    # ── GET /api/v1/filters ──

    def get_filters(self) -> FilterAvailability:
        def uniq_sorted(values: list[str]) -> list[str]:
            return sorted(set(values), key=_collation_key)

        return FilterAvailability(
            models=uniq_sorted([v.model for v in self.repo.variants]),
            colors=uniq_sorted([v.color for v in self.repo.variants]),
            sizes=uniq_sorted([v.size for v in self.repo.variants]),
        )

    # ── GET /api/v1/overview ──

    def get_overview(
        self,
        date_from: str | None,
        date_to: str | None,
        model: str | None,
        color: str | None,
        size: str | None,
    ) -> Overview:
        start, end = self._effective_range(date_from, date_to)
        variants = self._matching_variants(model, color, size)
        ids = {v.variant_id for v in variants}

        units_sold = 0
        sales_amount_clp = 0
        for p in self.repo.sales_history:
            if p.variant_id not in ids or not _overlaps(p, start, end):
                continue
            units_sold += p.units_sold
            sales_amount_clp += p.sales_amount_clp

        risk_counts: dict[str, int] = {
            "stockout": 0,
            "excess": 0,
            "balanced": 0,
            "insufficient_data": 0,
        }
        variants_at_risk = 0
        for v in variants:
            rec = self.repo.recommendations_by_variant.get(v.variant_id)
            if rec is None:
                continue
            risk_counts[rec.risk] += 1
            if rec.risk in {"stockout", "excess"}:
                variants_at_risk += 1

        return Overview(
            period_start=start,
            period_end=end,
            units_sold=units_sold,
            sales_amount_clp=sales_amount_clp,
            variants_total=len(variants),
            variants_at_risk=variants_at_risk,
            risk_counts=risk_counts,
        )

    # ── GET /api/v1/variants ──

    def list_variants(
        self,
        date_from: str | None,
        date_to: str | None,
        model: str | None,
        color: str | None,
        size: str | None,
        horizon_weeks: int | None,
        page: int,
        page_size: int,
    ) -> tuple[list[VariantRow], Pagination]:
        start, end = self._effective_range(date_from, date_to)
        horizon = horizon_weeks or self.repo.forecast_weeks
        if horizon > self.repo.forecast_weeks:
            raise BusinessValidationError(
                f"horizon_weeks admite como máximo {self.repo.forecast_weeks} "
                "(horizonte del fixture demo)."
            )

        rows: list[VariantRow] = []
        for v in self._matching_variants(model, color, size):
            units_period = 0
            amount_period = 0
            for p in self.repo.history_by_variant.get(v.variant_id, []):
                if not _overlaps(p, start, end):
                    continue
                units_period += p.units_sold
                amount_period += p.sales_amount_clp
            forecast = (self.repo.forecasts_by_variant.get(v.variant_id, []))[:horizon]
            forecast_total = (
                sum(f.predicted_units for f in forecast) if forecast else None
            )
            rec = self.repo.recommendations_by_variant.get(v.variant_id)
            rows.append(
                VariantRow(
                    **v.model_dump(),
                    units_sold_period=units_period,
                    sales_amount_clp_period=amount_period,
                    forecast_units_total=forecast_total,
                    coverage_weeks=rec.coverage_weeks if rec else None,
                    risk=rec.risk if rec else "insufficient_data",
                    action=rec.action if rec else "review_data",
                    suggested_units=rec.suggested_units if rec else None,
                    reason=(
                        rec.reason
                        if rec
                        else f"Sin recomendación calculada para {v.variant_id} en el fixture."
                    ),
                )
            )

        total = len(rows)
        slice_ = rows[(page - 1) * page_size : page * page_size]
        return slice_, Pagination(page=page, page_size=page_size, total=total)

    # ── GET /api/v1/variants/{variant_id} ──

    def get_variant(self, variant_id: str) -> VariantDetail:
        variant = self._variant_by_id(variant_id)
        rec: Recommendation | None = self.repo.recommendations_by_variant.get(variant_id)
        return VariantDetail(
            variant=variant,
            sales_history=self.repo.history_by_variant.get(variant_id, []),
            recommendation=rec,
            forecast=self.repo.forecasts_by_variant.get(variant_id, []),
        )

    # ── GET /api/v1/forecasts ──

    def get_forecasts(
        self,
        variant_id: str,
        date_from: str | None,
        date_to: str | None,
        horizon_weeks: int | None,
    ) -> ForecastSeries:
        variant = self._variant_by_id(variant_id)  # valida existencia → 404
        del variant
        horizon = horizon_weeks or self.repo.forecast_weeks
        if horizon > self.repo.forecast_weeks:
            raise BusinessValidationError(
                f"horizon_weeks admite como máximo {self.repo.forecast_weeks} "
                "(horizonte del fixture demo)."
            )
        start, end = self._effective_range(date_from, date_to)
        history = [
            p
            for p in self.repo.history_by_variant.get(variant_id, [])
            if _overlaps(p, start, end)
        ]
        forecast = (self.repo.forecasts_by_variant.get(variant_id, []))[:horizon]
        return ForecastSeries(history=history, forecast=forecast)

    # ── GET /api/v1/recommendations ──

    def get_recommendations(
        self,
        model: str | None,
        color: str | None,
        size: str | None,
        risk: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[Recommendation], Pagination]:
        ids = {v.variant_id for v in self._matching_variants(model, color, size)}
        selected = [
            r
            for r in self.repo.recommendations
            if r.variant_id in ids and (risk is None or r.risk == risk)
        ]
        selected.sort(
            key=lambda r: (ACTION_PRIORITY[r.action], _collation_key(r.variant_id))
        )
        total = len(selected)
        slice_ = selected[(page - 1) * page_size : page * page_size]
        return slice_, Pagination(page=page, page_size=page_size, total=total)
