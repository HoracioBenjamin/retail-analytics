import { describe, expect, it } from 'vitest'
import type { VariantRow } from '@shared/schemas'
import {
  calculateForecastExposure,
  calculateModelBreakdown,
  calculateSizeSales,
  calculateStockRotation
} from './reportMetrics'

function makeRow(overrides: Partial<VariantRow> & Pick<VariantRow, 'variant_id'>): VariantRow {
  return {
    product_id: 'p1',
    model: 'Aurora',
    brand: 'Duoc',
    color: 'Negro',
    size: '40',
    size_system: 's/d',
    stock_on_hand: 5,
    units_sold_period: 4,
    sales_amount_clp_period: 80_000,
    forecast_units_total: 12,
    coverage_weeks: 2,
    risk: 'stockout',
    action: 'review_data',
    suggested_units: null,
    reason: 'Prueba',
    ...overrides
  }
}

describe('calculateForecastExposure', () => {
  it('estimates uncovered forecast units and gross revenue from observed selling price', () => {
    const summary = calculateForecastExposure([
      makeRow({ variant_id: 'p1-40' }),
      makeRow({
        variant_id: 'p1-41',
        forecast_units_total: 8,
        stock_on_hand: 8
      })
    ])

    expect(summary.forecastVariants).toBe(2)
    expect(summary.uncoveredUnits).toBe(7)
    expect(summary.estimatedRevenueClp).toBe(140_000)
    expect(summary.rows[0].estimatedRevenueClp).toBe(140_000)
  })

  it('does not fabricate revenue when the variant has no observed unit price', () => {
    const summary = calculateForecastExposure([
      makeRow({
        variant_id: 'p1-40',
        units_sold_period: 0,
        sales_amount_clp_period: 0
      })
    ])

    expect(summary.uncoveredUnits).toBe(7)
    expect(summary.estimatedRevenueClp).toBe(0)
    expect(summary.unpricedVariants).toBe(1)
    expect(summary.rows).toEqual([])
  })

  it('returns no forecast exposure when inventory covers the projected demand', () => {
    const summary = calculateForecastExposure([
      makeRow({ variant_id: 'p1-40', forecast_units_total: 4, stock_on_hand: 5 })
    ])

    expect(summary.forecastVariants).toBe(1)
    expect(summary.uncoveredUnits).toBe(0)
    expect(summary.rows).toEqual([])
  })
})

describe('calculateSizeSales', () => {
  it('combines colors by size and identifies the best-selling size', () => {
    const result = calculateSizeSales([
      makeRow({ variant_id: 'p1-black-38', size: '38', units_sold_period: 4 }),
      makeRow({
        variant_id: 'p1-white-38',
        size: '38',
        color: 'Blanco',
        units_sold_period: 3
      }),
      makeRow({ variant_id: 'p1-black-40', size: '40', units_sold_period: 5 })
    ])

    expect(result.sizesRegistered).toBe(2)
    expect(result.bestSellingSizes).toEqual(['38'])
    expect(result.bestSellingUnits).toBe(7)
    expect(result.totalUnitsSold).toBe(12)
    expect(result.rows.map((row) => row.size)).toEqual(['38', '40'])
  })

  it('reports tied best-selling sizes and avoids declaring a winner without sales', () => {
    const tied = calculateSizeSales([
      makeRow({ variant_id: 'p1-38', size: '38', units_sold_period: 2 }),
      makeRow({ variant_id: 'p1-40', size: '40', units_sold_period: 2 })
    ])
    const empty = calculateSizeSales([
      makeRow({ variant_id: 'p1-38', size: '38', units_sold_period: 0 })
    ])

    expect(tied.bestSellingSizes).toEqual(['38', '40'])
    expect(empty.bestSellingSizes).toEqual([])
  })
})

describe('calculateStockRotation', () => {
  it('computes the sold share of sold and stock units for the filter', () => {
    const summary = calculateStockRotation([
      makeRow({ variant_id: 'p1-40' }),
      makeRow({
        variant_id: 'p1-41',
        units_sold_period: 1,
        stock_on_hand: 3,
        sales_amount_clp_period: 20_000
      })
    ])

    expect(summary.soldUnits).toBe(5)
    expect(summary.stockUnits).toBe(8)
    expect(summary.soldShare).toBeCloseTo(5 / 13)
  })

  it('returns null share when there are no units to show', () => {
    const summary = calculateStockRotation([
      makeRow({ variant_id: 'p1-40', units_sold_period: 0, stock_on_hand: 0 })
    ])

    expect(summary.soldUnits).toBe(0)
    expect(summary.stockUnits).toBe(0)
    expect(summary.soldShare).toBeNull()
  })
})

describe('calculateModelBreakdown', () => {
  it('aggregates confirmed sales by model sorted by revenue', () => {
    const breakdown = calculateModelBreakdown([
      makeRow({ variant_id: 'p1-40', model: 'Aurora' }),
      makeRow({
        variant_id: 'p2-40',
        model: 'Nimbus',
        sales_amount_clp_period: 150_000
      }),
      makeRow({ variant_id: 'p1-41', model: 'Aurora', sales_amount_clp_period: 40_000 })
    ])

    expect(breakdown).toEqual([
      { label: 'Nimbus', revenueClp: 150_000 },
      { label: 'Aurora', revenueClp: 120_000 }
    ])
  })

  it('reports zero-revenue models instead of hiding them', () => {
    const breakdown = calculateModelBreakdown([
      makeRow({ variant_id: 'p1-40', model: 'Aurora', units_sold_period: 0 }),
      makeRow({ variant_id: 'p2-40', model: 'Nimbus', units_sold_period: 0 })
    ])

    expect(breakdown).toEqual([
      { label: 'Aurora', revenueClp: 0 },
      { label: 'Nimbus', revenueClp: 0 }
    ])
  })
})
