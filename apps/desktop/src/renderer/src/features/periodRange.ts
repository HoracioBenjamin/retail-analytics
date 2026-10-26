/** Presets de período del Resumen (plan, sección 8): rango efectivo de fechas. */

export type Periodo = 'all' | '12' | '8' | '4'

export const PERIOD_LABELS: Record<Periodo, string> = {
  all: 'Todo el histórico (12 semanas)',
  '12': 'Últimas 12 semanas',
  '8': 'Últimas 8 semanas',
  '4': 'Últimas 4 semanas'
}

/** Semana de negocio: lunes–domingo; el corte es el fin del histórico. */
export function buildDateRange(
  periodo: Periodo,
  histEnd: string | null
): { date_from?: string; date_to?: string } {
  if (periodo === 'all' || !histEnd) return {}
  const weeks = Number(periodo)
  const end = new Date(`${histEnd}T00:00:00Z`)
  const from = new Date(end.getTime() - (weeks * 7 - 1) * 86400000).toISOString().slice(0, 10)
  return { date_from: from, date_to: histEnd }
}
