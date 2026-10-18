import { z } from 'zod'

/**
 * Contratos de dominio del modo demo (sección 9.2 del plan).
 * Los tipos TypeScript se derivan de estos esquemas zod para que main,
 * preload y renderer compartan una única fuente de verdad.
 *
 * Convenciones: los campos calculados que todavía no existen en la base
 * (`model_version`, `suggested_units`, `coverage_weeks`, metadatos del
 * fixture) son nullables y se documentan así en docs/CONTRATO_API.md
 * (se redacta en el Paso 6).
 */

export const FORECAST_METHODS = ['fixture', 'baseline', 'trained_model'] as const
export const RECOMMENDATION_ACTIONS = [
  'replenish',
  'maintain',
  'defer_purchase',
  'review_data'
] as const
export const RISK_LEVELS = ['stockout', 'excess', 'balanced', 'insufficient_data'] as const
export const AVAILABILITY_STATUSES = ['available', 'no_availability'] as const
export const DATA_SOURCES = ['demo', 'supabase'] as const

export type ForecastMethod = (typeof FORECAST_METHODS)[number]
export type RecommendationAction = (typeof RECOMMENDATION_ACTIONS)[number]
export type RiskLevel = (typeof RISK_LEVELS)[number]
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number]
export type DataSource = (typeof DATA_SOURCES)[number]

export const filtersSchema = z.object({
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_from debe ser YYYY-MM-DD')
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'date_to debe ser YYYY-MM-DD')
    .optional(),
  model: z.string().min(1).max(80).optional(),
  color: z.string().min(1).max(40).optional(),
  size: z.string().min(1).max(10).optional(),
  risk: z.enum(RISK_LEVELS).optional(),
  variant_id: z.string().min(1).max(120).optional(),
  horizon_weeks: z.number().int().min(1).max(24).optional(),
  page: z.number().int().min(1).optional(),
  page_size: z.number().int().min(1).max(200).optional()
})
export type Filters = z.infer<typeof filtersSchema>

export const variantSchema = z.object({
  variant_id: z.string().min(1),
  product_id: z.string().min(1),
  sku: z.string().min(1).optional(),
  model: z.string().min(1),
  brand: z.string().min(1),
  color: z.string().min(1),
  size: z.string().min(1),
  size_system: z.string().min(1),
  stock_on_hand: z.number().int().min(0)
})
export type Variant = z.infer<typeof variantSchema>

/**
 * Fila del listado de variantes (plan 9.4 GET /api/v1/variants): la variante
 * más los agregados derivados del mismo dataset canónico — ventas del
 * período filtrado, pronóstico ilustrativo total, cobertura y estado de
 * recomendación. Todos los campos de agregado son nullables cuando el
 * fixture no los provee (p. ej. datos insuficientes, cobertura no estimable).
 */
export const variantRowSchema = variantSchema.extend({
  units_sold_period: z.number().int().min(0),
  sales_amount_clp_period: z.number().int().min(0),
  // Suma del horizonte ilustrativo; null si la variante no tiene pronóstico.
  forecast_units_total: z.number().nullable(),
  // Cobertura informativa en semanas; null → "No estimable" (demanda cero/no fiable).
  coverage_weeks: z.number().nullable(),
  risk: z.enum(RISK_LEVELS),
  action: z.enum(RECOMMENDATION_ACTIONS),
  suggested_units: z.number().int().min(0).nullable(),
  reason: z.string().min(1)
})
export type VariantRow = z.infer<typeof variantRowSchema>

export const salesPointSchema = z.object({
  variant_id: z.string().min(1),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  units_sold: z.number().int().min(0),
  sales_amount_clp: z.number().int().min(0),
  availability_status: z.enum(AVAILABILITY_STATUSES)
})
export type SalesPoint = z.infer<typeof salesPointSchema>

export const forecastPointSchema = z.object({
  variant_id: z.string().min(1),
  period_start: z.string().min(1),
  period_end: z.string().min(1),
  predicted_units: z.number(),
  method: z.enum(FORECAST_METHODS),
  // null en modo demo: todavía no hay modelo versionado (Paso fuera de A/B).
  model_version: z.string().min(1).nullable()
})
export type ForecastPoint = z.infer<typeof forecastPointSchema>

/** Parámetros de cálculo de una recomendación (plan 9.2: "parámetros de cálculo"). */
export const recommendationParametersSchema = z.object({
  lead_time_weeks: z.number(),
  review_period_weeks: z.number(),
  safety_stock_weeks: z.number(),
  coverage_period_weeks: z.number(),
  excess_threshold_weeks: z.number(),
  stockout_threshold_weeks: z.number(),
  demand_weeks_used: z.number().int().min(0),
  units_in_transit: z.number().int().min(0)
})
export type RecommendationParameters = z.infer<typeof recommendationParametersSchema>

export const recommendationSchema = z.object({
  variant_id: z.string().min(1),
  action: z.enum(RECOMMENDATION_ACTIONS),
  // null cuando los datos son insuficientes para sugerir una cantidad.
  suggested_units: z.number().int().min(0).nullable(),
  // null cuando la demanda es cero o no fiable: se muestra "No estimable".
  coverage_weeks: z.number().nullable(),
  risk: z.enum(RISK_LEVELS),
  reason: z.string().min(1),
  // Parámetros con que se calculó la regla ilustrativa (transparencia de la base).
  parameters: recommendationParametersSchema.optional()
})
export type Recommendation = z.infer<typeof recommendationSchema>

export const periodRangeSchema = z
  .object({
    start: z.string().min(1),
    end: z.string().min(1)
  })
  .nullable()

export const dataMetadataSchema = z.object({
  data_source: z.enum(DATA_SOURCES),
  data_mode: z.enum(['demo-local', 'demo-api', 'connected']),
  // nullables hasta que el fixture canónico exista (Paso 5).
  as_of: z.string().min(1).nullable(),
  historical_range: periodRangeSchema,
  forecast_range: periodRangeSchema,
  forecast_method: z.enum(FORECAST_METHODS),
  limitations: z.array(z.string()).min(1),
  dataset_version: z.string().min(1).nullable()
})
export type DataMetadata = z.infer<typeof dataMetadataSchema>

export const overviewSchema = z.object({
  period_start: z.string().min(1).nullable(),
  period_end: z.string().min(1).nullable(),
  units_sold: z.number().int().min(0),
  sales_amount_clp: z.number().int().min(0),
  variants_total: z.number().int().min(0),
  variants_at_risk: z.number().int().min(0),
  risk_counts: z.record(z.enum(RISK_LEVELS), z.number().int().min(0))
})
export type Overview = z.infer<typeof overviewSchema>

export const paginationSchema = z.object({
  page: z.number().int().min(1),
  page_size: z.number().int().min(1),
  total: z.number().int().min(0)
})
export type Pagination = z.infer<typeof paginationSchema>

/** Respuesta uniforme del plan (sección 9.4): data + meta; listados suman pagination. */
export const responseMetaSchema = z.object({
  mode: z.enum(['demo-local', 'demo-api', 'connected'])
})
export type ResponseMeta = z.infer<typeof responseMetaSchema>

/** Error de contrato para el renderer (sección 9.4): código y mensaje estables. */
export const apiErrorSchema = z.object({
  code: z.enum(['NOT_FOUND', 'VALIDATION_ERROR', 'SERVICE_UNAVAILABLE', 'IPC_REJECTED']),
  message: z.string().min(1)
})
export type ApiError = z.infer<typeof apiErrorSchema>
