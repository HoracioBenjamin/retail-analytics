import type { VariantRow } from '@shared/schemas'

export interface ExposureRow {
  variantId: string
  label: string
  uncoveredUnits: number
  estimatedRevenueClp: number | null
}

export interface ExposureSummary {
  forecastVariants: number
  uncoveredUnits: number
  estimatedRevenueClp: number
  unpricedVariants: number
  rows: ExposureRow[]
}

export interface SizeSalesRow {
  size: string
  unitsSold: number
  salesClp: number
  stockOnHand: number
}

export interface SizeSalesSummary {
  sizesRegistered: number
  bestSellingSizes: string[]
  bestSellingUnits: number
  totalUnitsSold: number
  rows: SizeSalesRow[]
}

function compareSizes(a: string, b: string): number {
  const numericA = Number(a)
  const numericB = Number(b)
  if (Number.isFinite(numericA) && Number.isFinite(numericB)) return numericA - numericB
  return a.localeCompare(b, 'es-CL', { numeric: true, sensitivity: 'base' })
}

export function calculateSizeSales(rows: VariantRow[]): SizeSalesSummary {
  const bySize = new Map<string, SizeSalesRow>()
  for (const row of rows) {
    const current = bySize.get(row.size) ?? {
      size: row.size,
      unitsSold: 0,
      salesClp: 0,
      stockOnHand: 0
    }
    current.unitsSold += row.units_sold_period
    current.salesClp += row.sales_amount_clp_period
    current.stockOnHand += row.stock_on_hand
    bySize.set(row.size, current)
  }

  const sizeRows = [...bySize.values()].sort((a, b) => compareSizes(a.size, b.size))
  const bestSellingUnits = sizeRows.reduce((maxUnits, row) => Math.max(maxUnits, row.unitsSold), 0)

  return {
    sizesRegistered: sizeRows.length,
    bestSellingSizes:
      bestSellingUnits > 0
        ? sizeRows.filter((row) => row.unitsSold === bestSellingUnits).map((row) => row.size)
        : [],
    bestSellingUnits,
    totalUnitsSold: sizeRows.reduce((total, row) => total + row.unitsSold, 0),
    rows: sizeRows
  }
}

export function calculateForecastExposure(rows: VariantRow[]): ExposureSummary {
  const exposureRows = rows.flatMap((row) => {
    if (row.forecast_units_total === null || row.forecast_units_total <= row.stock_on_hand) {
      return []
    }

    const uncoveredUnits = row.forecast_units_total - row.stock_on_hand
    const averageUnitPrice =
      row.units_sold_period > 0 ? row.sales_amount_clp_period / row.units_sold_period : null

    return [
      {
        variantId: row.variant_id,
        label: `${row.model} · ${row.color} · T${row.size}`,
        uncoveredUnits,
        estimatedRevenueClp:
          averageUnitPrice === null ? null : Math.round(uncoveredUnits * averageUnitPrice)
      }
    ]
  })

  const pricedRows = exposureRows.filter(
    (row): row is ExposureRow & { estimatedRevenueClp: number } => row.estimatedRevenueClp !== null
  )

  return {
    forecastVariants: rows.filter((row) => row.forecast_units_total !== null).length,
    uncoveredUnits: exposureRows.reduce((total, row) => total + row.uncoveredUnits, 0),
    estimatedRevenueClp: pricedRows.reduce((total, row) => total + row.estimatedRevenueClp, 0),
    unpricedVariants: exposureRows.length - pricedRows.length,
    rows: pricedRows.sort((a, b) => b.estimatedRevenueClp - a.estimatedRevenueClp)
  }
}
