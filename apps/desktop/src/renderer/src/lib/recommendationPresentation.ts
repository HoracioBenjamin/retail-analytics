import type { Recommendation } from '@shared/schemas'
import { fmtNum } from './format'

type RecommendationInfo = Pick<Recommendation, 'action' | 'suggested_units' | 'reason'>

export function isMissingSupplierLeadTime(recommendation: RecommendationInfo): boolean {
  // La API actual comunica este bloqueo en el motivo, sin un código separado.
  return (
    recommendation.action === 'review_data' &&
    recommendation.reason.includes('SUPPLIER_LEAD_TIME_WEEKS')
  )
}

export function recommendationActionLabel(recommendation: RecommendationInfo): string {
  if (isMissingSupplierLeadTime(recommendation)) return 'Falta plazo del proveedor'
  switch (recommendation.action) {
    case 'replenish':
      return 'Reponer inventario'
    case 'defer_purchase':
      return 'No comprar por ahora'
    case 'maintain':
      return 'Mantener inventario'
    case 'review_data':
      return 'Revisar datos'
  }
}

export function recommendationQuantityLabel(recommendation: RecommendationInfo): string {
  const units = recommendation.suggested_units
  if (units === null) return 'Compra por evaluar'
  return `${fmtNum(units)} ${units === 1 ? 'unidad sugerida' : 'unidades sugeridas'}`
}

export function recommendationReasonLabel(recommendation: RecommendationInfo): string {
  if (isMissingSupplierLeadTime(recommendation)) {
    return 'Hay una estimación de demanda y cobertura, pero falta el plazo de entrega del proveedor para evaluar si conviene reponer y cuántas unidades comprar.'
  }
  return recommendation.reason
}
