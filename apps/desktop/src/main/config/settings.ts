import { z } from 'zod'

/**
 * Configuración del proceso main (Paso 3; las variables de entorno de la
 * sección 11 del plan se formalizan con .env.example).
 * Modo por defecto: demo-local. El modo 'connected' no está implementado
 * en A/B y se rechaza de forma explícita (nunca fallback silencioso).
 */
export type DATA_MODE = 'demo-local' | 'demo-api' | 'connected'

export const dataModeSchema = z.enum(['demo-local', 'demo-api', 'connected'])

export function resolveDataMode(): DATA_MODE {
  const raw = process.env['MAIN_VITE_DATA_MODE']
  if (!raw) return 'demo-local'
  const parsed = dataModeSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `MAIN_VITE_DATA_MODE inválido: "${raw}". Valores: demo-local, demo-api, connected`
    )
  }
  return parsed.data
}

export const API_BASE_URL = process.env['MAIN_VITE_ANALYTICS_API_URL'] ?? 'http://127.0.0.1:8000'
