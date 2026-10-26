import type {
  ApiResult,
  AnalyticsApi,
  DataStatusResult,
  FilterAvailability,
  ForecastSeries,
  OverviewResult,
  RecommendationList,
  VariantDetail,
  VariantList
} from '../../shared/contracts'
import type { Filters } from '../../shared/schemas'
import { ProviderValidationError } from './provider'

/**
 * Proveedor HTTP (etapa C):
 * - `demo-api`: FastAPI sirve el fixture canónico.
 * - `connected`: FastAPI lee Supabase (solo SELECT, clave pública, RLS).
 *
 * React NUNCA habla con la base de datos: el único camino es este
 * proveedor (proceso main) → HTTP local 127.0.0.1:8000 → FastAPI → Supabase.
 *
 * Regla anti-silencio: si la API no responde, el error se propaga con código
 * estable (SERVICE_UNAVAILABLE). NUNCA hay fallback a datos demo.
 */

const REQUEST_TIMEOUT_MS = 20_000

/** Códigos HTTP → códigos estables del sobre del plan (sección 9.4). */
function statusToCode(status: number): ProviderValidationError['code'] {
  if (status === 404) return 'NOT_FOUND'
  if (status === 422) return 'VALIDATION_ERROR'
  if (status === 403) return 'PERMISSION_DENIED'
  return 'SERVICE_UNAVAILABLE'
}

const STABLE_CODES = new Set([
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'SERVICE_UNAVAILABLE',
  'PERMISSION_DENIED'
])

interface Envelope {
  ok?: boolean
  data?: unknown
  meta?: unknown
  pagination?: unknown
  error?: { code?: string; message?: string }
}

type OkOut = Promise<{ ok: true; data: unknown; meta: unknown; pagination?: unknown }>

export class ApiHttpProvider implements AnalyticsApi {
  constructor(private readonly baseUrl: string) {
    if (!/^https?:\/\/[^\s]+$/.test(baseUrl)) {
      throw new Error(`MAIN_VITE_ANALYTICS_API_URL inválido: "${baseUrl}".`)
    }
  }

  private request(path: string, params: Record<string, string | number | undefined>): OkOut {
    return (async () => {
      const url = new URL(path, `${this.baseUrl}/`)
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, String(value))
      }
      let response: Response
      try {
        response = await fetch(url.toString(), {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
        })
      } catch (issue) {
        // red caída, timeout o DNS: distinto de un error de permisos
        throw new ProviderValidationError(
          `No se pudo contactar la API analítica en ${this.baseUrl} — ¿está corriendo "uvicorn app.main:app"? (docs/DEPENDENCIAS.md · docs/CONSULTAS_SUPABASE.md). Detalle: ${String(issue)}`,
          'SERVICE_UNAVAILABLE'
        )
      }

      const json = (await response.json().catch(() => ({}))) as Envelope

      if (!response.ok) {
        const code = json.error?.code
        const message =
          json.error?.message ?? `La API analítica respondió HTTP ${response.status} para ${path}.`
        if (code && STABLE_CODES.has(code)) {
          throw new ProviderValidationError(message, code as ProviderValidationError['code'])
        }
        throw new ProviderValidationError(message, statusToCode(response.status))
      }

      if (json.ok !== true || json.data === undefined) {
        throw new ProviderValidationError(
          `Respuesta inesperada de ${path}: sobre sin data ni ok.`,
          'SERVICE_UNAVAILABLE'
        )
      }
      return { ok: true, data: json.data, meta: json.meta, pagination: json.pagination }
    })()
  }

  private filters(filters: Filters): Record<string, string | number | undefined> {
    return {
      date_from: filters.date_from,
      date_to: filters.date_to,
      model: filters.model,
      color: filters.color,
      size: filters.size,
      risk: filters.risk,
      variant_id: filters.variant_id,
      horizon_weeks: filters.horizon_weeks,
      page: filters.page,
      page_size: filters.page_size
    }
  }

  getOverview(filters: Filters): ApiResult<OverviewResult> {
    return this.request('/api/v1/overview', this.filters(filters)) as ApiResult<OverviewResult>
  }

  getFilters(): ApiResult<FilterAvailability> {
    return this.request('/api/v1/filters', {}) as ApiResult<FilterAvailability>
  }

  listVariants(filters: Filters): ApiResult<VariantList> {
    return this.request('/api/v1/variants', this.filters(filters)) as ApiResult<VariantList>
  }

  getVariant(variantId: string): ApiResult<VariantDetail> {
    // El segmento va URL-encodeado: ids "p101-38" viajan seguros en la ruta.
    const encoded = encodeURIComponent(variantId)
    return this.request(`/api/v1/variants/${encoded}`, {}) as ApiResult<VariantDetail>
  }

  getForecasts(filters: Filters): ApiResult<ForecastSeries> {
    return this.request('/api/v1/forecasts', this.filters(filters)) as ApiResult<ForecastSeries>
  }

  getRecommendations(filters: Filters): ApiResult<RecommendationList> {
    return this.request(
      '/api/v1/recommendations',
      this.filters(filters)
    ) as ApiResult<RecommendationList>
  }

  getDataStatus(forceRefresh = false): ApiResult<DataStatusResult> {
    return this.request('/api/v1/data-status', {
      refresh: forceRefresh ? 1 : undefined
    }) as ApiResult<DataStatusResult>
  }
}
