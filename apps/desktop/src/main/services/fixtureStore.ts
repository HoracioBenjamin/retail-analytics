import { existsSync, readFileSync } from 'fs'
import { z } from 'zod'
import {
  forecastPointSchema,
  recommendationSchema,
  salesPointSchema,
  variantSchema
} from '../../shared/schemas'
import type { ForecastPoint, Recommendation, SalesPoint, Variant } from '../../shared/schemas'

/**
 * Almacén del dataset canónico `fixtures/demo-v1.json` (plan 9.1).
 * Módulo puro (sin importar `electron`) para poder validarlo con vitest.
 * La ruta la resuelve el provider (necesita `app`; ver demo-local.ts).
 */

export const fixtureSchema = z.object({
  dataset_version: z.string().min(1),
  generated: z.string().min(1),
  as_of: z.string().min(1),
  historical_weeks: z.number().int().min(0),
  forecast_weeks: z.number().int().min(0),
  base_currency: z.literal('CLP'),
  variants: z.array(variantSchema),
  sales_history: z.array(salesPointSchema),
  forecasts: z.array(forecastPointSchema),
  recommendations: z.array(recommendationSchema)
})

export interface FixtureDataset extends z.infer<typeof fixtureSchema> {
  variants: Variant[]
  sales_history: SalesPoint[]
  forecasts: ForecastPoint[]
  recommendations: Recommendation[]
}

export interface FixtureLoadResult {
  dataset: FixtureDataset | null
  /** null si cargó; si no, texto del problema para los metadatos (nunca silencio). */
  error: string | null
}

function crossIntegrityIssues(d: FixtureDataset): string[] {
  const issues: string[] = []
  const ids = new Set(d.variants.map((v) => v.variant_id))
  if (ids.size !== d.variants.length) issues.push('variant_id duplicados en el fixture')
  const historyOk = d.sales_history.every((s) => ids.has(s.variant_id))
  if (!historyOk) issues.push('sales_history con variant_id desconocido')
  const forecastOk = d.forecasts.every((f) => ids.has(f.variant_id))
  if (!forecastOk) issues.push('forecasts con variant_id desconocido')
  const recOk = d.recommendations.every((r) => ids.has(r.variant_id))
  if (!recOk) issues.push('recommendations con variant_id desconocido')
  return issues
}

export function loadFixture(path: string): FixtureLoadResult {
  if (!existsSync(path)) {
    return {
      dataset: null,
      error: `No se encontró el dataset canónico en ${path} (se genera en el Paso 5).`
    }
  }
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    const parsed = fixtureSchema.parse(raw)
    const dataset = parsed as FixtureDataset
    const issues = crossIntegrityIssues(dataset)
    if (issues.length > 0) {
      return { dataset: null, error: `Fixture incoherente: ${issues.join('; ')}` }
    }
    return { dataset, error: null }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return { dataset: null, error: `Fixture inválido: ${detail}` }
  }
}
