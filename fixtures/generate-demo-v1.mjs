/**
 * Generador del dataset canónico de demostración `fixtures/demo-v1.json`.
 *
 * Plan, sección 9.1:
 * - 4 modelos ficticios × 2 colores × 5 tallas EU = 40 variantes.
 * - 12 semanas históricas (lunes–domingo, America/Santiago).
 * - 4 semanas futuras ilustrativas (method "fixture", model_version null).
 * - Casos cubiertos: demanda alta/stock bajo, demanda baja/stock alto,
 *   equilibrio, cero ventas, datos insuficientes y falta de disponibilidad.
 * - La misma variante en varios colores/tallas con comportamientos distintos.
 *
 * Determinismo: semilla fija (mulberry32) y fecha de corte fija
 * `as_of = 2026-09-28` (lunes). NO depende de Math.random() ni de la fecha
 * del computador: correr el script siempre produce el mismo archivo.
 *
 * Ejecución (desde la raíz del proyecto):  node fixtures/generate-demo-v1.mjs
 */

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SEED = 20260928
const AS_OF = '2026-09-28' // lunes: fecha de corte fija (fin del histórico)
const GENERATED_AT = '2026-09-28T09:00:00-03:00' // fijo: determinista
const HISTORICAL_WEEKS = 12
const FORECAST_WEEKS = 4
const DATASET_VERSION = 'demo-v1.0.0'

/* ── PRNG determinista (mulberry32) ─────────────────────────────── */

function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(SEED)

/* ── Semanas de negocio (lunes–domingo) ─────────────────────────── */

const DAY_MS = 86400000
// Lunes inicial: el corte es lunes; el histórico son las 12 semanas anteriores.
const FIRST_MONDAY = new Date(`${AS_OF}T00:00:00Z`).getTime() - HISTORICAL_WEEKS * 7 * DAY_MS

function weekPeriod(w) {
  const start = new Date(FIRST_MONDAY + w * 7 * DAY_MS)
  const end = new Date(FIRST_MONDAY + (w * 7 + 6) * DAY_MS)
  const iso = (d) => d.toISOString().slice(0, 10)
  return { period_start: iso(start), period_end: iso(end) }
}

/* ── Reglas ilustrativas (plan 9.3) ─────────────────────────────── */

const LEAD_TIME_WEEKS = 2
const REVIEW_PERIOD_WEEKS = 1
const SAFETY_STOCK_WEEKS = 0.5
const COVERAGE_PERIOD_WEEKS = LEAD_TIME_WEEKS + REVIEW_PERIOD_WEEKS // 3
const EXCESS_THRESHOLD_WEEKS = 8
const STOCKOUT_THRESHOLD_WEEKS = 2
const MIN_WEEKS_FOR_RECOMMENDATION = 6 // semanas con disponibilidad mínimas para recomendar

/* ── Catálogo y perfiles de demanda (unidades/semana base) ──────── */

const SIZES = ['38', '40', '42', '44', '46']
const COLORS = [
  { name: 'Negro', slug: 'negro', mult: 1.1 },
  { name: 'Blanco', slug: 'blanco', mult: 0.9 }
]

const MODELS = [
  {
    name: 'Aurora Running',
    slug: 'aurora',
    price: 79990,
    // Demanda alta. Tallas centrales con stock bajo → riesgo de faltante.
    baseBySize: { '38': 6, '40': 16, '42': 15, '44': 9, '46': 5 },
    stock: {
      negro: { '38': 26, '40': 6, '42': 8, '44': 40, '46': 18 },
      blanco: { '38': 12, '40': 4, '42': 45, '44': 70, '46': 14 }
      // 40/42 ambos colores → stockout; 44 blanco → exceso (cobertura > 8 sem);
      // la misma variante en el otro color queda equilibrada.
    },
    inTransit: { 'aurora-negro-42': 12 } // demostración: unidades en camino reducen la sugerencia
  },
  {
    name: 'Córdoba Court',
    slug: 'cordoba',
    price: 69990,
    // Rotación baja con stock elevado → exceso; talla 38 con cero ventas.
    baseBySize: { '38': 0, '40': 1.2, '42': 2.0, '44': 1.5, '46': 0.8 },
    stock: {
      negro: { '38': 22, '40': 55, '42': 70, '44': 60, '46': 35 },
      blanco: { '38': 18, '40': 48, '42': 62, '44': 44, '46': 28 }
    },
    inTransit: {}
  },
  {
    name: 'Volcán Trail',
    slug: 'volcan',
    price: 84990,
    // Demanda media con stock dimensionado → equilibrio.
    baseBySize: { '38': 3.5, '40': 7, '42': 8.5, '44': 6, '46': 3 },
    stock: {
      negro: { '38': 12, '40': 22, '42': 30, '44': 18, '46': 10 },
      blanco: { '38': 11, '40': 20, '42': 27, '44': 16, '46': 9 }
    },
    inTransit: {}
  },
  {
    name: 'Insignia Urbana',
    slug: 'insignia',
    price: 59990,
    // Sin disponibilidad desde la semana 6 → datos insuficientes y falta de disponibilidad.
    baseBySize: { '38': 2, '40': 5, '42': 6, '44': 4, '46': 2 },
    stock: {
      negro: { '38': 0, '40': 0, '42': 0, '44': 0, '46': 0 },
      blanco: { '38': 0, '40': 0, '42': 0, '44': 0, '46': 0 }
    },
    unavailableFromWeek: 5,
    inTransit: {}
  }
]

/* ── Construcción del dataset ───────────────────────────────────── */

const variants = []
const sales_history = []
const forecasts = []
const recommendations = []

const weekIdxOfVariant = new Map() // variant_id → índices de semanas con disponibilidad
const demandOfVariant = new Map() // variant_id → promedio semanal (últimas 4 semanas disponibles)

for (const model of MODELS) {
  for (const color of COLORS) {
    for (const size of SIZES) {
      const variant_id = `${model.slug}-${color.slug}-${size}`
      const unavailableFrom =
        'unavailableFromWeek' in model ? model.unavailableFromWeek : null
      const base = Math.max(0, model.baseBySize[size] * color.mult)

      variants.push({
        variant_id,
        product_id: `p-${model.slug}`,
        sku: `TA-${model.slug.slice(0, 4).toUpperCase()}-${color.slug.slice(0, 3).toUpperCase()}-${size}`,
        model: model.name,
        brand: 'Travesía Andina',
        color: color.name,
        size,
        size_system: 'EU',
        stock_on_hand: model.stock[color.slug][size]
      })

      // Historial de 12 semanas.
      const availableWeeks = []
      const unitsByWeek = []
      for (let w = 0; w < HISTORICAL_WEEKS; w++) {
        const period = weekPeriod(w)
        const isUnavailable = unavailableFrom !== null && w >= unavailableFrom
        let units = 0
        if (!isUnavailable && base > 0) {
          // ±25 % de variación semanal determinista; Córdoba 38 queda en 0.
          units = Math.max(0, Math.round(base * (0.75 + rand() * 0.5)))
        }
        if (!isUnavailable) availableWeeks.push(w)
        unitsByWeek[w] = units
        sales_history.push({
          variant_id,
          period_start: period.period_start,
          period_end: period.period_end,
          units_sold: units,
          sales_amount_clp: units * model.price,
          availability_status: isUnavailable ? 'no_availability' : 'available'
        })
      }
      weekIdxOfVariant.set(variant_id, availableWeeks)

      // Demanda semanal estimada: promedio de las últimas 4 semanas con disponibilidad.
      const recent = availableWeeks.slice(-4)
      const avgDemand =
        recent.length > 0
          ? recent.reduce((acc, w) => acc + unitsByWeek[w], 0) / recent.length
          : 0
      demandOfVariant.set(variant_id, avgDemand)

      // Pronóstico ilustrativo de 4 semanas (method "fixture", model_version null).
      const lastAvailableEnd =
        availableWeeks.length > 0 ? weekPeriod(availableWeeks[availableWeeks.length - 1]).period_end : AS_OF
      for (let f = 0; f < FORECAST_WEEKS; f++) {
        const period = weekPeriod(HISTORICAL_WEEKS + f)
        const predicted =
          avgDemand <= 0 ? 0 : Math.round(avgDemand * (0.9 + rand() * 0.2) * 10) / 10
        // Nota: la primera semana futura arranca el día después del final del histórico.
        if (period.period_start <= lastAvailableEnd) {
          throw new Error(`Solapamiento histórico/futuro en ${variant_id}`)
        }
        forecasts.push({
          variant_id,
          period_start: period.period_start,
          period_end: period.period_end,
          predicted_units: predicted,
          method: 'fixture',
          model_version: null
        })
      }

      // Recomendación ilustrativa según la regla del plan 9.3.
      const stock = model.stock[color.slug][size]
      const inTransit = model.inTransit[variant_id] ?? 0
      const weeksAvailableCount = availableWeeks.length
      const fmt = (n) => Number(n.toFixed(1)).toLocaleString('es-CL')

      if (weeksAvailableCount < MIN_WEEKS_FOR_RECOMMENDATION) {
        recommendations.push({
          variant_id,
          action: 'review_data',
          suggested_units: null,
          coverage_weeks: null,
          risk: 'insufficient_data',
          reason:
            `Solo ${weeksAvailableCount} de ${HISTORICAL_WEEKS} semanas con disponibilidad ` +
            `(sin abastecimiento desde la semana ${unavailableFrom + 1}). ` +
            'Datos insuficientes para una recomendación categórica: revisar disponibilidad histórica.',
          parameters: {
            lead_time_weeks: LEAD_TIME_WEEKS,
            review_period_weeks: REVIEW_PERIOD_WEEKS,
            safety_stock_weeks: SAFETY_STOCK_WEEKS,
            coverage_period_weeks: COVERAGE_PERIOD_WEEKS,
            excess_threshold_weeks: EXCESS_THRESHOLD_WEEKS,
            stockout_threshold_weeks: STOCKOUT_THRESHOLD_WEEKS,
            demand_weeks_used: weeksAvailableCount,
            units_in_transit: inTransit
          }
        })
        continue
      }

      const coverage = avgDemand > 0 ? Math.round((stock / avgDemand) * 10) / 10 : null
      const demandaTxt = `Demanda estimada ${fmt(avgDemand)} uds/semana (últimas 4 semanas con disponibilidad)`

      // Cero rotación con semanas disponibles: cobertura "No estimable" (plan 9.3).
      if (avgDemand <= 0) {
        recommendations.push({
          variant_id,
          action: 'defer_purchase',
          suggested_units: null,
          coverage_weeks: null,
          risk: 'excess',
          reason:
            `Sin ventas en ${HISTORICAL_WEEKS} semanas con disponibilidad (stock ${stock}, en camino ` +
            `${inTransit}). Cobertura no estimable por demanda cero: posponer compras y revisar ` +
            'rotación antes de reabastecer.',
          parameters: {
            lead_time_weeks: LEAD_TIME_WEEKS,
            review_period_weeks: REVIEW_PERIOD_WEEKS,
            safety_stock_weeks: SAFETY_STOCK_WEEKS,
            coverage_period_weeks: COVERAGE_PERIOD_WEEKS,
            excess_threshold_weeks: EXCESS_THRESHOLD_WEEKS,
            stockout_threshold_weeks: STOCKOUT_THRESHOLD_WEEKS,
            demand_weeks_used: weeksAvailableCount,
            units_in_transit: inTransit
          }
        })
        continue
      }

      if (coverage > EXCESS_THRESHOLD_WEEKS) {
        recommendations.push({
          variant_id,
          action: 'defer_purchase',
          suggested_units: null,
          coverage_weeks: coverage,
          risk: 'excess',
          reason:
            `Cobertura ${fmt(coverage)} semanas (stock ${stock}, en camino ${inTransit}) supera ` +
            `el umbral de exceso de ${EXCESS_THRESHOLD_WEEKS} semanas. ${demandaTxt}: posponer compras ` +
            'hasta que la cobertura baje del umbral.',
          parameters: {
            lead_time_weeks: LEAD_TIME_WEEKS,
            review_period_weeks: REVIEW_PERIOD_WEEKS,
            safety_stock_weeks: SAFETY_STOCK_WEEKS,
            coverage_period_weeks: COVERAGE_PERIOD_WEEKS,
            excess_threshold_weeks: EXCESS_THRESHOLD_WEEKS,
            stockout_threshold_weeks: STOCKOUT_THRESHOLD_WEEKS,
            demand_weeks_used: recent.length,
            units_in_transit: inTransit
          }
        })
        continue
      }

      const wantsPurchase = coverage < STOCKOUT_THRESHOLD_WEEKS
      if (wantsPurchase) {
        const suggested = Math.max(
          0,
          Math.ceil(
            avgDemand * COVERAGE_PERIOD_WEEKS + Math.ceil(avgDemand * SAFETY_STOCK_WEEKS) - stock - inTransit
          )
        )
        recommendations.push({
          variant_id,
          action: 'replenish',
          suggested_units: suggested,
          coverage_weeks: coverage,
          risk: 'stockout',
          reason:
            `Cobertura ${fmt(coverage)} semanas (stock ${stock}, en camino ${inTransit}) es menor que ` +
            `el plazo del proveedor (${LEAD_TIME_WEEKS} semanas). ${demandaTxt}: reponer ` +
            `${COVERAGE_PERIOD_WEEKS} semanas de cobertura + stock de seguridad ` +
            `(${SAFETY_STOCK_WEEKS} semana).`,
          parameters: {
            lead_time_weeks: LEAD_TIME_WEEKS,
            review_period_weeks: REVIEW_PERIOD_WEEKS,
            safety_stock_weeks: SAFETY_STOCK_WEEKS,
            coverage_period_weeks: COVERAGE_PERIOD_WEEKS,
            excess_threshold_weeks: EXCESS_THRESHOLD_WEEKS,
            stockout_threshold_weeks: STOCKOUT_THRESHOLD_WEEKS,
            demand_weeks_used: recent.length,
            units_in_transit: inTransit
          }
        })
        continue
      }

      recommendations.push({
        variant_id,
        action: 'maintain',
        suggested_units: null,
        coverage_weeks: coverage,
        risk: 'balanced',
        reason:
          `Cobertura ${fmt(coverage)} semanas (stock ${stock}, en camino ${inTransit}) se encuentra ` +
          `entre los umbrales de stockout (${STOCKOUT_THRESHOLD_WEEKS}) y exceso ` +
          `(${EXCESS_THRESHOLD_WEEKS}). ${demandaTxt}: no se requiere movimiento.`,
        parameters: {
          lead_time_weeks: LEAD_TIME_WEEKS,
          review_period_weeks: REVIEW_PERIOD_WEEKS,
          safety_stock_weeks: SAFETY_STOCK_WEEKS,
          coverage_period_weeks: COVERAGE_PERIOD_WEEKS,
          excess_threshold_weeks: EXCESS_THRESHOLD_WEEKS,
          stockout_threshold_weeks: STOCKOUT_THRESHOLD_WEEKS,
          demand_weeks_used: recent.length,
          units_in_transit: inTransit
        }
      })
    }
  }
}

/* ── Validaciones de coherencia del dataset ─────────────────────── */

const errors = []
const variantIds = new Set(variants.map((v) => v.variant_id))
if (variants.length !== 40) errors.push(`Se esperaban 40 variantes, hay ${variants.length}`)
if (sales_history.length !== 40 * HISTORICAL_WEEKS)
  errors.push(`Historial: ${sales_history.length} puntos (esperados ${40 * HISTORICAL_WEEKS})`)
if (forecasts.length !== 40 * FORECAST_WEEKS)
  errors.push(`Pronóstico: ${forecasts.length} puntos (esperados ${40 * FORECAST_WEEKS})`)
if (recommendations.length !== 40) errors.push(`Recomendaciones: ${recommendations.length} (esperadas 40)`)

for (const s of sales_history) if (!variantIds.has(s.variant_id)) errors.push(`Historial con variante desconocida: ${s.variant_id}`)
for (const f of forecasts) if (!variantIds.has(f.variant_id)) errors.push(`Pronóstico con variante desconocida: ${f.variant_id}`)
for (const r of recommendations) if (!variantIds.has(r.variant_id)) errors.push(`Recomendación con variante desconocida: ${r.variant_id}`)

// Casos obligatorios de la sección 9.1.
const byAction = { replenish: 0, maintain: 0, defer_purchase: 0, review_data: 0 }
for (const r of recommendations) byAction[r.action] += 1
if (byAction.replenish < 2) errors.push('Falta caso demanda alta/stock bajo (replenish)')
if (byAction.defer_purchase < 2) errors.push('Falta caso demanda baja/stock alto (defer_purchase)')
if (byAction.maintain < 2) errors.push('Falta caso equilibrio (maintain)')
if (byAction.review_data < 2) errors.push('Falta caso datos insuficientes (review_data)')
const zeroSalesVariants = [...weekIdxofVariantOrEmpty('cordoba-negro-38', sales_history)]
if (!zeroSalesVariants.every((p) => p.units_sold === 0))
  errors.push('La variante cordoba-negro-38 debería tener cero ventas en todo el histórico')
const unavailable = sales_history.filter((p) => p.availability_status === 'no_availability')
if (unavailable.length < 7 * 10) errors.push('Falta de disponibilidad insuficiente en el fixture')

function weekIdxofVariantOrEmpty(vid, history) {
  return history.filter((p) => p.variant_id === vid)
}

if (errors.length > 0) {
  console.error('VALIDACIÓN FALLIDA:\n' + errors.map((e) => ` - ${e}`).join('\n'))
  process.exit(1)
}

/* ── Escritura del archivo ───────────────────────────────────────── */

const dataset = {
  dataset_version: DATASET_VERSION,
  generated: GENERATED_AT,
  as_of: AS_OF,
  historical_weeks: HISTORICAL_WEEKS,
  forecast_weeks: FORECAST_WEEKS,
  base_currency: 'CLP',
  variants,
  sales_history,
  forecasts,
  recommendations
}

const outPath = join(dirname(fileURLToPath(import.meta.url)), 'demo-v1.json')
writeFileSync(outPath, JSON.stringify(dataset, null, 2) + '\n', 'utf-8')

console.log(`✓ fixture escrito: ${outPath}`)
console.log(`  variantes: ${variants.length} · historial: ${sales_history.length} · pronóstico: ${forecasts.length} · recomendaciones: ${recommendations.length}`)
const counts = Object.entries(byAction).map(([k, v]) => `${k}=${v}`).join(' · ')
console.log(`  acciones: ${counts}`)
const riskCounts = { stockout: 0, excess: 0, balanced: 0, insufficient_data: 0 }
for (const r of recommendations) riskCounts[r.risk] += 1
console.log(`  riesgos: ${Object.entries(riskCounts).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
const minPeriod = weekPeriod(0).period_start
const maxPeriod = weekPeriod(HISTORICAL_WEEKS - 1).period_end
console.log(`  histórico: ${minPeriod} → ${maxPeriod} · as_of: ${AS_OF}`)
