/** Presets de período del Resumen (plan, sección 8): rango efectivo de fechas. */

export type Periodo = 'all' | '12' | '8' | '4'

export const PERIOD_LABELS: Record<Periodo, string> = {
  all: 'Todo el histórico disponible',
  '12': 'Últimas 12 semanas',
  '8': 'Últimas 8 semanas',
  '4': 'Últimas 4 semanas'
}

export interface TrendRange {
  date_from: string
  date_to: string
  label: string
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

/** Builds up to 12 weekly windows, ending at the dataset cutoff. */
export function buildWeeklyTrendRanges(
  periodo: Periodo,
  histStart: string | null,
  histEnd: string | null
): TrendRange[] {
  if (!histStart || !histEnd) return []

  const end = new Date(`${histEnd}T00:00:00Z`)
  const historyStart = new Date(`${histStart}T00:00:00Z`)
  const weeks = periodo === 'all' ? 12 : Number(periodo)
  const requestedStart = new Date(end.getTime() - (weeks * 7 - 1) * 86400000)
  const start = historyStart > requestedStart ? historyStart : requestedStart
  const ranges: TrendRange[] = []

  for (let cursor = start; cursor <= end;) {
    const windowEnd = new Date(Math.min(cursor.getTime() + 6 * 86400000, end.getTime()))
    const dateFrom = cursor.toISOString().slice(0, 10)
    const dateTo = windowEnd.toISOString().slice(0, 10)
    const label = new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC'
    })
      .format(cursor)
      .replace('.', '')
    ranges.push({ date_from: dateFrom, date_to: dateTo, label })
    cursor = new Date(windowEnd.getTime() + 86400000)
  }

  return ranges
}
