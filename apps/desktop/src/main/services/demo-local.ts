import { join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'
import type {
  DataStatusResult,
  FilterAvailability,
  ForecastSeries,
  OverviewResult,
  RecommendationList,
  VariantDetail,
  VariantList
} from '../../shared/contracts'
import {
  dataMetadataSchema,
  overviewSchema,
  paginationSchema,
  variantRowSchema
} from '../../shared/schemas'
import type {
  DataMetadata,
  Filters,
  ForecastPoint,
  Recommendation,
  SalesPoint,
  Variant,
  VariantRow
} from '../../shared/schemas'
import { ProviderValidationError } from './provider'
import { loadFixture } from './fixtureStore'
import type { FixtureDataset } from './fixtureStore'

/**
 * Proveedor demo-local (Entrega A): única fuente canónica
 * `fixtures/demo-v1.json`. Todos los KPIs, filtros, rankings y
 * recomendaciones se DERIVAN del fixture con la misma regla ilustrativa
 * con que se generó (plan 9.3) — no hay números escritos a mano en el
 * código. Si el fixture no existe o es incoherente, los metadatos lo
 * declaran explícitamente y ninguna pantalla muestra números.
 */

export class NotFoundVariantError extends Error {
  constructor(public readonly variantId: string) {
    super(`Variante desconocida: ${variantId}`)
  }
}

export function resolveFixturePath(): string {
  // En desarrollo app.getAppPath() es apps/desktop; el fixture vive 2 niveles arriba.
  const dev = join(app.getAppPath(), '..', '..', 'fixtures', 'demo-v1.json')
  const packaged = process.resourcesPath
    ? join(process.resourcesPath, 'fixtures', 'demo-v1.json')
    : null
  if (packaged && existsSync(packaged)) return packaged
  return dev
}

/* ── Utilidades de filtrado y agregación ─────────────────────────── */

function matchesVariantFilters(v: Variant, f: Filters): boolean {
  const eq = (a: string | undefined, b: string | undefined): boolean =>
    a === undefined || b === undefined || a.toLowerCase() === b.toLowerCase()
  return eq(v.model, f.model) && eq(v.color, f.color) && eq(v.size, f.size)
}

function overlapsRange(
  point: { period_start: string; period_end: string },
  from: string,
  to: string
): boolean {
  return point.period_end >= from && point.period_start <= to
}

function emptyRiskCounts(): Record<
  'stockout' | 'excess' | 'balanced' | 'insufficient_data',
  number
> {
  return { stockout: 0, excess: 0, balanced: 0, insufficient_data: 0 }
}

const ACTION_PRIORITY: Record<Recommendation['action'], number> = {
  replenish: 0,
  defer_purchase: 1,
  review_data: 2,
  maintain: 3
}

export class DemoLocalProvider {
  readonly mode = 'demo-local' as const

  private readonly dataset: FixtureDataset | null
  private readonly loadError: string | null
  private readonly historyByVariant: Map<string, SalesPoint[]>
  private readonly forecastsByVariant: Map<string, ForecastPoint[]>
  private readonly recByVariant: Map<string, Recommendation>

  constructor() {
    const loaded = this.load()
    this.dataset = loaded.dataset
    this.loadError = loaded.error
    this.historyByVariant = new Map()
    this.forecastsByVariant = new Map()
    this.recByVariant = new Map()
    if (this.dataset) {
      for (const p of this.dataset.sales_history) {
        const list = this.historyByVariant.get(p.variant_id) ?? []
        list.push(p)
        this.historyByVariant.set(p.variant_id, list)
      }
      for (const p of this.dataset.forecasts) {
        const list = this.forecastsByVariant.get(p.variant_id) ?? []
        list.push(p)
        this.forecastsByVariant.set(p.variant_id, list)
      }
      for (const r of this.dataset.recommendations) {
        this.recByVariant.set(r.variant_id, r)
      }
    }
  }

  private load(): { dataset: FixtureDataset | null; error: string | null } {
    try {
      return loadFixture(resolveFixturePath())
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      return { dataset: null, error: `No se pudo cargar el fixture: ${detail}` }
    }
  }

  private requireDataset(): FixtureDataset {
    if (!this.dataset) {
      throw new ProviderValidationError(
        this.loadError ?? 'Dataset de demostración no disponible.',
        'VALIDATION_ERROR'
      )
    }
    return this.dataset
  }

  /* ── Rango efectivo del período histórico ── */

  private historyBounds(): { min: string; max: string } {
    const d = this.requireDataset()
    let min: string | null = null
    let max: string | null = null
    for (const p of d.sales_history) {
      if (min === null || p.period_start < min) min = p.period_start
      if (max === null || p.period_end > max) max = p.period_end
    }
    if (min === null || max === null) {
      throw new ProviderValidationError(
        'El fixture no contiene historial de ventas.',
        'VALIDATION_ERROR'
      )
    }
    return { min, max }
  }

  private effectiveRange(filters: Filters): { from: string; to: string } {
    const b = this.historyBounds()
    return { from: filters.date_from ?? b.min, to: filters.date_to ?? b.max }
  }

  private matchingVariants(filters: Filters): Variant[] {
    const d = this.requireDataset()
    const out = d.variants.filter((v) => matchesVariantFilters(v, filters))
    // Orden estable y localizable: modelo, color y talla (comparación es-CL).
    const cmp = new Intl.Collator('es', { numeric: true }).compare
    return out.sort((a, b) => cmp(a.model, b.model) || cmp(a.color, b.color) || cmp(a.size, b.size))
  }

  /* ── Endpoints del contrato ── */

  async getOverview(filters: Filters): Promise<OverviewResult> {
    const d = this.requireDataset()
    const range = this.effectiveRange(filters)
    const variants = this.matchingVariants(filters)
    const ids = new Set(variants.map((v) => v.variant_id))

    let units_sold = 0
    let sales_amount_clp = 0
    for (const p of d.sales_history) {
      if (!ids.has(p.variant_id)) continue
      if (!overlapsRange(p, range.from, range.to)) continue
      units_sold += p.units_sold
      sales_amount_clp += p.sales_amount_clp
    }

    const riskCounts = emptyRiskCounts()
    let variants_at_risk = 0
    for (const v of variants) {
      const rec = this.recByVariant.get(v.variant_id)
      if (!rec) continue
      riskCounts[rec.risk] += 1
      if (rec.risk === 'stockout' || rec.risk === 'excess') variants_at_risk += 1
    }

    return {
      data: overviewSchema.parse({
        period_start: range.from,
        period_end: range.to,
        units_sold,
        sales_amount_clp,
        variants_total: variants.length,
        variants_at_risk,
        risk_counts: riskCounts
      }),
      ok: true as const,
      meta: { mode: this.mode }
    }
  }

  async getFilters(): Promise<FilterAvailability> {
    const d = this.requireDataset()
    const col = new Intl.Collator('es')
    const uniqSorted = (values: string[]): string[] =>
      [...new Set(values)].sort((a, b) => col.compare(a, b))
    return {
      data: {
        models: uniqSorted(d.variants.map((v) => v.model)),
        colors: uniqSorted(d.variants.map((v) => v.color)),
        sizes: uniqSorted(d.variants.map((v) => v.size))
      },
      ok: true as const,
      meta: { mode: this.mode }
    }
  }

  async listVariants(filters: Filters): Promise<VariantList> {
    const d = this.requireDataset()
    const range = this.effectiveRange(filters)
    const horizon = filters.horizon_weeks ?? d.forecast_weeks
    if (horizon > d.forecast_weeks) {
      throw new ProviderValidationError(
        `horizon_weeks admite como máximo ${d.forecast_weeks} (horizonte del fixture demo).`,
        'VALIDATION_ERROR'
      )
    }

    const rows: VariantRow[] = this.matchingVariants(filters).map((v) => {
      let units_sold_period = 0
      let sales_amount_clp_period = 0
      for (const p of this.historyByVariant.get(v.variant_id) ?? []) {
        if (!overlapsRange(p, range.from, range.to)) continue
        units_sold_period += p.units_sold
        sales_amount_clp_period += p.sales_amount_clp
      }
      const forecast = (this.forecastsByVariant.get(v.variant_id) ?? []).slice(0, horizon)
      const forecast_units_total =
        forecast.length > 0 ? forecast.reduce((acc, p) => acc + p.predicted_units, 0) : null
      const rec = this.recByVariant.get(v.variant_id)
      return variantRowSchema.parse({
        ...v,
        units_sold_period,
        sales_amount_clp_period,
        forecast_units_total,
        coverage_weeks: rec?.coverage_weeks ?? null,
        risk: rec?.risk ?? 'insufficient_data',
        action: rec?.action ?? 'review_data',
        suggested_units: rec?.suggested_units ?? null,
        reason: rec?.reason ?? `Sin recomendación calculada para ${v.variant_id} en el fixture.`
      })
    })

    const page = filters.page ?? 1
    const page_size = filters.page_size ?? 20
    const total = rows.length
    const slice = rows.slice((page - 1) * page_size, page * page_size)

    return {
      data: slice,
      ok: true as const,
      meta: { mode: this.mode },
      pagination: paginationSchema.parse({ page, page_size, total })
    }
  }

  async getVariant(variantId: string): Promise<VariantDetail> {
    this.requireDataset()
    const variant = (this.dataset?.variants ?? []).find((v) => v.variant_id === variantId)
    if (!variant) {
      throw new NotFoundVariantError(variantId)
    }
    return {
      data: {
        variant,
        sales_history: this.historyByVariant.get(variantId) ?? [],
        recommendation: this.recByVariant.get(variantId) ?? null,
        forecast: this.forecastsByVariant.get(variantId) ?? []
      },
      ok: true as const,
      meta: { mode: this.mode }
    }
  }

  async getForecasts(filters: Filters): Promise<ForecastSeries> {
    this.requireDataset()
    if (!filters.variant_id) {
      throw new ProviderValidationError(
        'getForecasts requiere variant_id: el detalle de pronóstico es por variante.',
        'VALIDATION_ERROR'
      )
    }
    const variant = this.dataset?.variants.find((v) => v.variant_id === filters.variant_id)
    if (!variant) {
      throw new NotFoundVariantError(filters.variant_id)
    }
    if (
      filters.horizon_weeks !== undefined &&
      filters.horizon_weeks > (this.dataset?.forecast_weeks ?? 0)
    ) {
      throw new ProviderValidationError(
        `horizon_weeks admite como máximo ${this.dataset?.forecast_weeks} (horizonte del fixture demo).`,
        'VALIDATION_ERROR'
      )
    }
    const horizon = filters.horizon_weeks ?? this.dataset?.forecast_weeks ?? 0
    const range = this.effectiveRange(filters)

    const history = (this.historyByVariant.get(filters.variant_id) ?? []).filter((p) =>
      overlapsRange(p, range.from, range.to)
    )
    const forecast = (this.forecastsByVariant.get(filters.variant_id) ?? []).slice(0, horizon)

    return {
      data: { history, forecast },
      ok: true as const,
      meta: { mode: this.mode }
    }
  }

  async getRecommendations(filters: Filters): Promise<RecommendationList> {
    const d = this.requireDataset()
    const variants = this.matchingVariants(filters)
    const ids = new Set(variants.map((v) => v.variant_id))
    const sorted = d.recommendations
      .filter((r) => ids.has(r.variant_id))
      .filter((r) => filters.risk === undefined || r.risk === filters.risk)
      .sort(
        (a, b) =>
          ACTION_PRIORITY[a.action] - ACTION_PRIORITY[b.action] ||
          new Intl.Collator('es', { numeric: true }).compare(a.variant_id, b.variant_id)
      )

    const page = filters.page ?? 1
    const page_size = filters.page_size ?? 50
    const slice = sorted.slice((page - 1) * page_size, page * page_size)

    return {
      data: slice,
      ok: true as const,
      meta: { mode: this.mode },
      pagination: paginationSchema.parse({ page, page_size, total: sorted.length })
    }
  }

  private metadata(): DataMetadata {
    const d = this.dataset
    if (!d) {
      return dataMetadataSchema.parse({
        data_source: 'demo',
        data_mode: this.mode,
        as_of: null,
        historical_range: null,
        forecast_range: null,
        forecast_method: 'fixture',
        limitations: [
          this.loadError ?? 'Dataset de demostración no disponible.',
          'Ninguna pantalla mostrará datos mientras el fixture no cargue correctamente.'
        ],
        dataset_version: null
      })
    }
    let histStart: string | null = null
    let histEnd: string | null = null
    for (const p of d.sales_history) {
      if (histStart === null || p.period_start < histStart) histStart = p.period_start
      if (histEnd === null || p.period_end > histEnd) histEnd = p.period_end
    }
    let fcStart: string | null = null
    let fcEnd: string | null = null
    for (const p of d.forecasts) {
      if (fcStart === null || p.period_start < fcStart) fcStart = p.period_start
      if (fcEnd === null || p.period_end > fcEnd) fcEnd = p.period_end
    }
    return dataMetadataSchema.parse({
      data_source: 'demo',
      data_mode: this.mode,
      as_of: d.as_of,
      historical_range: { start: histStart, end: histEnd },
      forecast_range: { start: fcStart, end: fcEnd },
      forecast_method: 'fixture',
      limitations: [
        `Dataset de demostración determinista ${d.dataset_version} (generado ${d.generated}); sin modelo entrenado.`,
        `Los valores futuros (${d.forecast_weeks} semanas) son ilustrativos, method "fixture", model_version null.`,
        'Alcance del período de cobertura: plazo de proveedor + frecuencia de revisión; reglas ilustrativas de la base, no un motor de decisión.',
        'El modo connected usa FastAPI y Supabase; este proveedor sirve solo el fixture demo.'
      ],
      dataset_version: d.dataset_version
    })
  }

  async getDataStatus(_forceRefresh = false): Promise<DataStatusResult> {
    return {
      data: {
        metadata: this.metadata(),
        fixture_available: this.dataset !== null
      },
      ok: true as const,
      meta: { mode: this.mode }
    }
  }
}

/** Export también como clase por compatibilidad del main (Paso 3). */
export { DemoLocalProvider as default }
