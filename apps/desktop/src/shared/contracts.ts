/**
 * Contratos de canal del puente IPC (plan, Paso 3 y sección 9.4).
 * El preload expone EXCLUSIVAMENTE estos métodos; el renderer no conoce
 * los nombres de canales IPC ni recibe ipcRenderer completo.
 *
 * Toda llamada devuelve un sobre discriminado:
 *   - éxito:  { ok: true, data, meta, pagination? }
 *   - fallo:  { ok: false, error: { code, message } }
 * Esto evita que los errores asíncronos pierdan su código al cruzar
 * el canal IPC (Electron serializa los throw como Error genérico).
 */

import type {
  DataMetadata,
  Filters,
  ForecastPoint,
  Overview,
  Pagination,
  Recommendation,
  ResponseMeta,
  SalesPoint,
  Variant,
  VariantRow,
  ApiError
} from './schemas'

export interface ApiEnvelopeBase {
  ok: true
  meta: ResponseMeta
}

export interface ApiErrorEnvelope {
  ok: false
  error: ApiError
}

export type ApiResult<R> = Promise<R | ApiErrorEnvelope>

export interface OverviewResult extends ApiEnvelopeBase {
  data: Overview
}

export interface FilterAvailability extends ApiEnvelopeBase {
  data: { models: string[]; colors: string[]; sizes: string[] }
}

export interface VariantList extends ApiEnvelopeBase {
  data: VariantRow[]
  pagination: Pagination
}

export interface VariantDetail extends ApiEnvelopeBase {
  data: {
    variant: Variant
    sales_history: SalesPoint[]
    /** Recomendación calculada para la variante (null si no está en el fixture). */
    recommendation: Recommendation | null
    /** Pronóstico ilustrativo de la variante (hasta forecast_weeks puntos). */
    forecast: ForecastPoint[]
  }
}

export interface ForecastSeries extends ApiEnvelopeBase {
  data: {
    history: SalesPoint[]
    forecast: ForecastPoint[]
  }
}

export interface RecommendationList extends ApiEnvelopeBase {
  data: Recommendation[]
  pagination: Pagination
}

export interface DataStatusResult extends ApiEnvelopeBase {
  data: {
    metadata: DataMetadata
    fixture_available: boolean
  }
}

export interface AnalyticsApi {
  getOverview(filters: Filters): ApiResult<OverviewResult>
  getFilters(): ApiResult<FilterAvailability>
  listVariants(filters: Filters): ApiResult<VariantList>
  getVariant(variantId: string): ApiResult<VariantDetail>
  getForecasts(filters: Filters): ApiResult<ForecastSeries>
  getRecommendations(filters: Filters): ApiResult<RecommendationList>
  getDataStatus(forceRefresh?: boolean): ApiResult<DataStatusResult>
}
