import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { loadFixture } from './fixtureStore'

/**
 * Validación del dataset canónico fixtures/demo-v1.json contra los
 * esquemas del Paso 3 + casos obligatorios de la sección 9.1 del plan.
 * No depende de Electron: fixtureStore.ts es un módulo puro.
 */

// `npm run test` siempre se ejecuta desde apps/desktop: el fixture vive 2 niveles arriba.
const FIXTURE_PATH = join(process.cwd(), '..', '..', 'fixtures', 'demo-v1.json')

describe('fixtures/demo-v1.json', () => {
  const { dataset, error } = loadFixture(FIXTURE_PATH)
  const d = dataset

  it('carga contra los esquemas sin error', () => {
    expect(error).toBeNull()
    expect(d).not.toBeNull()
  })

  it('tiene la forma 4 modelos × 2 colores × 5 tallas = 40 variantes', () => {
    expect(d?.variants.length).toBe(40)
    const ids = new Set(d?.variants.map((v) => v.variant_id))
    expect(ids.size).toBe(40)
    for (const v of d?.variants ?? []) {
      expect(v.stock_on_hand).toBeGreaterThanOrEqual(0)
      expect(v.size_system).toBe('EU')
    }
  })

  it('tiene 12 semanas de historial por variante (480 puntos) y 4 de pronóstico (160)', () => {
    expect(d?.sales_history.length).toBe(480)
    expect(d?.forecasts.length).toBe(160)
    for (const id of d?.variants.map((v) => v.variant_id) ?? []) {
      expect(d?.sales_history.filter((s) => s.variant_id === id).length).toBe(12)
      expect(d?.forecasts.filter((f) => f.variant_id === id).length).toBe(4)
    }
  })

  it('semana de negocio lunes–domingo y primer pronóstico posterior al histórico', () => {
    for (const s of d?.sales_history ?? []) {
      expect(s.period_start < s.period_end).toBe(true)
      expect(s.sales_amount_clp).toBeGreaterThanOrEqual(0)
      expect(s.units_sold).toBeGreaterThanOrEqual(0)
    }
    const lastHistEnd = (d?.sales_history ?? [])
      .map((s) => s.period_end)
      .reduce((a, b) => (a > b ? a : b))
    for (const f of d?.forecasts ?? []) {
      expect(f.period_start > lastHistEnd).toBe(true)
      expect(f.method).toBe('fixture')
      expect(f.model_version).toBeNull()
    }
  })

  it('cubre demanda alta / stock bajo (replenish, cobertura < plazo proveedor)', () => {
    const replenish = d?.recommendations.filter((r) => r.action === 'replenish') ?? []
    expect(replenish.length).toBeGreaterThanOrEqual(2)
    for (const r of replenish) {
      expect(r.risk).toBe('stockout')
      expect(r.suggested_units).toBeGreaterThan(0)
      expect(r.coverage_weeks).toBeLessThan(2)
    }
  })

  it('cubre demanda baja / stock alto (defer_purchase) y demanda cero con cobertura null', () => {
    const defer = d?.recommendations.filter((r) => r.action === 'defer_purchase') ?? []
    expect(defer.length).toBeGreaterThanOrEqual(2)
    // Caso cero ventas: Córdoba 38 en ambos colores.
    for (const id of ['cordoba-negro-38', 'cordoba-blanco-38']) {
      const width = d?.sales_history.filter((s) => s.variant_id === id) ?? []
      expect(width.length).toBe(12)
      expect(width.every((p) => p.units_sold === 0)).toBe(true)
    }
  })

  it('cubre equilibrio (maintain) entre umbrales 2 y 8 semanas de cobertura', () => {
    const maintain = d?.recommendations.filter((r) => r.action === 'maintain') ?? []
    expect(maintain.length).toBeGreaterThanOrEqual(2)
    for (const r of maintain) {
      expect(r.risk).toBe('balanced')
      expect(r.coverage_weeks).toBeGreaterThanOrEqual(2)
      expect(r.coverage_weeks).toBeLessThanOrEqual(8)
    }
  })

  it('cubre datos insuficientes y falta de disponibilidad (Insignia, review_data, unidades null)', () => {
    const review = d?.recommendations.filter((r) => r.action === 'review_data') ?? []
    expect(review.length).toBeGreaterThanOrEqual(2)
    for (const r of review) {
      expect(r.risk).toBe('insufficient_data')
      expect(r.suggested_units).toBeNull()
      expect(r.coverage_weeks).toBeNull()
    }
    const unAvailable = d?.sales_history.filter(
      (s) => s.variant_id.startsWith('insignia-') && s.availability_status === 'no_availability'
    )
    expect(unAvailable?.length).toBeGreaterThan(0)
  })

  it('cada recomendación referencia una variante conocida y trae parámetros de cálculo', () => {
    const ids = new Set(d?.variants.map((v) => v.variant_id))
    for (const r of d?.recommendations ?? []) {
      expect(ids.has(r.variant_id)).toBe(true)
      expect(r.reason.length).toBeGreaterThan(10)
      expect(r.parameters).toBeDefined()
      expect(r.parameters?.demand_weeks_used).toBeGreaterThanOrEqual(0)
    }
  })

  it('moneda CLP y fecha de corte fija (determinismo)', () => {
    expect(d?.base_currency).toBe('CLP')
    expect(d?.as_of).toBe('2026-09-28')
    expect(d?.historical_weeks).toBe(12)
    expect(d?.forecast_weeks).toBe(4)
  })
})
