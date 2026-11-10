/**
 * Coincidencia de texto simple para las búsquedas client-side de las
 * pantallas: insensible a mayúsculas y espacios en los extremos. Sin
 * acentos no se normalizan (los catálogos usan ortografía estable) para
 * no ocultar diferencias reales, p. ej. "Aurora" vs "Aurora 2".
 */
export function textMatches(term: string, ...fields: Array<string | null | undefined>): boolean {
  const query = term.trim().toLowerCase()
  if (!query) return true
  return fields.some((field) => (field ?? '').toLowerCase().includes(query))
}
