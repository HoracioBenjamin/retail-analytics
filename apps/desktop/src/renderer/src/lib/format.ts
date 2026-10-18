/**
 * Formateo local es-CL (plan, sección 8: CLP, locale es-CL y fechas de
 * negocio consistentes con America/Santiago). Se usa UTC para que las
 * etiquetas de fecha NO cambien con la zona horaria del computador.
 */

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0
})

export function fmtCLP(value: number): string {
  return clpFormatter.format(value)
}

export function fmtNum(value: number, maxFrac = 1): string {
  return value.toLocaleString('es-CL', { maximumFractionDigits: maxFrac })
}

/** Etiqueta corta de semana: semana que inicia 2026-07-06 → "06 jul". */
export function weekLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .format(d)
    .replace('.', '')
}

/** Rango compacto para metadatos: "06 jul – 27 sep 2026". */
export function rangeLabel(start: string, end: string): string {
  const year = new Date(`${end}T00:00:00Z`).getUTCFullYear()
  return `${weekLabel(start)} – ${weekLabel(end)} ${year}`
}

/** Fecha larga para el estado de datos: "lunes 28 de septiembre de 2026". */
export function longDate(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'full', timeZone: 'UTC' }).format(d)
}

/** Cobertura informativa del plan 9.3: null → "No estimable". */
export function fmtCoverage(weeks: number | null): string {
  return weeks === null ? 'No estimable' : `${fmtNum(weeks)} sem`
}
