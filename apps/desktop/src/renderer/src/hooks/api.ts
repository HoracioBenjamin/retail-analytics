import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type {
  DataStatusResult,
  FilterAvailability,
  ForecastSeries,
  OverviewResult,
  RecommendationList,
  VariantDetail,
  VariantList
} from '@shared/contracts'
import type { DataMetadata, Filters } from '@shared/schemas'
import { analyticsApi, callOk } from '@/services/analytics'

/**
 * Hooks de datos (plan, Paso 5): todas las pantallas consultan el MISMO
 * conjunto a través del puente tipado. La clave incluye los filtros: cada
 * combinación es un dato distinto y "Actualizar vista" invalida por lote.
 */

/* ── Claves de query ── */

type QueryKey = readonly unknown[]

function jsonKey(scope: string, filters: Partial<Filters>): QueryKey {
  return [scope, JSON.stringify(filters, Object.keys(filters).sort())] as const
}

export const qk = {
  status: ['data-status'] as const,
  filters: ['filters'] as const,
  overview: (f: Partial<Filters>): QueryKey => jsonKey('overview', f),
  variants: (f: Partial<Filters>): QueryKey => jsonKey('variants', f),
  variant: (id: string): QueryKey => ['variant', id] as const,
  forecasts: (f: Partial<Filters>): QueryKey => jsonKey('forecasts', f),
  recommendations: (f: Partial<Filters>): QueryKey => jsonKey('recommendations', f)
}

/* ── Filtros base: sin filtros aplicados ── */

export const noFilters: Partial<Filters> = {}

/* ── Hooks de cada contrato ── */

export function useDataStatus(): UseQueryResult<DataStatusResult['data']> {
  return useQuery({
    queryKey: qk.status,
    queryFn: () => callOk(analyticsApi.getDataStatus()).then((r) => r.data)
  })
}

export function useFiltersAvailability(): UseQueryResult<FilterAvailability['data']> {
  return useQuery({
    queryKey: qk.filters,
    queryFn: () => callOk(analyticsApi.getFilters()).then((r) => r.data)
  })
}

export function useOverview(filters: Partial<Filters>): UseQueryResult<OverviewResult['data']> {
  return useQuery({
    queryKey: qk.overview(filters),
    queryFn: () => callOk(analyticsApi.getOverview(filters as Filters)).then((r) => r.data)
  })
}

/**
 * Filas completas de variantes (page_size 200 = total en demo): la tabla
 * realiza búsqueda/orden/paginación local sobre los mismos datos canónicos.
 */
export function useVariantRows(): UseQueryResult<VariantList['data']> {
  return useQuery({
    queryKey: qk.variants(noFilters),
    queryFn: () =>
      callOk(analyticsApi.listVariants({ page: 1, page_size: 200 })).then((r) => r.data)
  })
}

export function useVariantDetail(variantId: string | null): UseQueryResult<VariantDetail['data']> {
  return useQuery({
    queryKey: variantId ? qk.variant(variantId) : (['variant', null] as const),
    enabled: variantId !== null,
    queryFn: () => callOk(analyticsApi.getVariant(variantId as string)).then((r) => r.data)
  })
}

export function useForecastSeries(
  variantId: string | null
): UseQueryResult<ForecastSeries['data']> {
  return useQuery({
    queryKey: variantId ? qk.forecasts({ variant_id: variantId }) : (['forecasts', null] as const),
    enabled: variantId !== null,
    queryFn: () =>
      callOk(analyticsApi.getForecasts({ variant_id: variantId as string })).then((r) => r.data)
  })
}

export function useRecommendations(
  filters: Partial<Filters>
): UseQueryResult<RecommendationList['data']> {
  return useQuery({
    queryKey: qk.recommendations(filters),
    queryFn: () =>
      callOk(
        analyticsApi.getRecommendations({ ...filters, page: 1, page_size: 200 } as Filters)
      ).then((r) => r.data)
  })
}

/** Alias legible para los metadatos (usado en cabeceras y estados). */
export function useDatasetMetadata(): DataMetadata | undefined {
  return useDataStatus().data?.metadata
}
