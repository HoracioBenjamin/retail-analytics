"""Esquemas de dominio de la API demo — espejo Python de `shared/schemas.ts`.

Única regla de mantenimiento: si cambia el contrato zod del escritorio,
estos modelos cambian en espejo (mismos campos, mismos nullables). El
fixture JSON ya está en snake_case, así que la serialización es directa.
"""

from typing import Literal

from pydantic import BaseModel, Field

ForecastMethod = Literal["fixture", "baseline", "trained_model"]
RecommendationAction = Literal["replenish", "maintain", "defer_purchase", "review_data"]
RiskLevel = Literal["stockout", "excess", "balanced", "insufficient_data"]
AvailabilityStatus = Literal["available", "no_availability"]
DataMode = Literal["demo-local", "demo-api", "connected"]


class Variant(BaseModel):
    variant_id: str = Field(min_length=1)
    product_id: str = Field(min_length=1)
    sku: str | None = None
    model: str = Field(min_length=1)
    brand: str = Field(min_length=1)
    color: str = Field(min_length=1)
    size: str = Field(min_length=1)
    size_system: str = Field(min_length=1)
    stock_on_hand: int = Field(ge=0)


class RecommendationParameters(BaseModel):
    lead_time_weeks: float
    review_period_weeks: float
    safety_stock_weeks: float
    coverage_period_weeks: float
    excess_threshold_weeks: float
    stockout_threshold_weeks: float
    demand_weeks_used: int = Field(ge=0)
    units_in_transit: int = Field(ge=0)


class Recommendation(BaseModel):
    variant_id: str = Field(min_length=1)
    action: RecommendationAction
    suggested_units: int | None = Field(default=None, ge=0)
    coverage_weeks: float | None = None
    risk: RiskLevel
    reason: str = Field(min_length=1)
    parameters: RecommendationParameters | None = None


class SalesPoint(BaseModel):
    variant_id: str = Field(min_length=1)
    period_start: str = Field(min_length=1)
    period_end: str = Field(min_length=1)
    units_sold: int = Field(ge=0)
    sales_amount_clp: int = Field(ge=0)
    availability_status: AvailabilityStatus


class ForecastPoint(BaseModel):
    variant_id: str = Field(min_length=1)
    period_start: str = Field(min_length=1)
    period_end: str = Field(min_length=1)
    predicted_units: float
    method: ForecastMethod
    # null en la base A/B: no hay modelo versionado (etapa posterior).
    model_version: str | None = None


class VariantRow(Variant):
    """GET /api/v1/variants: variante + agregados derivados del mismo dataset."""

    units_sold_period: int = Field(ge=0)
    sales_amount_clp_period: int = Field(ge=0)
    forecast_units_total: float | None = None
    coverage_weeks: float | None = None
    risk: RiskLevel
    action: RecommendationAction
    suggested_units: int | None = Field(default=None, ge=0)
    reason: str = Field(min_length=1)


class PeriodRange(BaseModel):
    start: str
    end: str


class DataMetadata(BaseModel):
    data_source: Literal["demo", "supabase"]
    data_mode: DataMode
    as_of: str | None = None
    historical_range: PeriodRange | None = None
    forecast_range: PeriodRange | None = None
    forecast_method: ForecastMethod
    limitations: list[str] = Field(min_length=1)
    dataset_version: str | None = None


class Overview(BaseModel):
    period_start: str | None = None
    period_end: str | None = None
    units_sold: int = Field(ge=0)
    sales_amount_clp: int = Field(ge=0)
    variants_total: int = Field(ge=0)
    variants_at_risk: int = Field(ge=0)
    risk_counts: dict[str, int]


class Pagination(BaseModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)
    total: int = Field(ge=0)


class FilterAvailability(BaseModel):
    models: list[str]
    colors: list[str]
    sizes: list[str]


class ForecastSeries(BaseModel):
    history: list[SalesPoint]
    forecast: list[ForecastPoint]


class VariantDetail(BaseModel):
    variant: Variant
    sales_history: list[SalesPoint]
    recommendation: Recommendation | None = None
    forecast: list[ForecastPoint]


class DataStatus(BaseModel):
    metadata: DataMetadata
    fixture_available: bool


# ── Sobre de respuesta uniforme { error: {code, message} } para fallos ──

ERROR_CODES = Literal["NOT_FOUND", "VALIDATION_ERROR", "SERVICE_UNAVAILABLE"]


class ApiErrorBody(BaseModel):
    code: ERROR_CODES
    message: str = Field(min_length=1)


class ApiErrorEnvelope(BaseModel):
    error: ApiErrorBody


class ResponseMeta(BaseModel):
    mode: DataMode = "demo-api"
