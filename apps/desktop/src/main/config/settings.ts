import { z } from 'zod'

/**
 * Configuración del proceso main (Paso 3; las variables de entorno de la
 * sección 11 del plan se formalizan con .env.example).
 * Modo por defecto: demo-local. El modo 'connected' no está implementado
 * en A/B y se rechaza de forma explícita (nunca fallback silencioso).
 */
export type DATA_MODE = 'demo-local' | 'demo-api' | 'connected'

export const dataModeSchema = z.enum(['demo-local', 'demo-api', 'connected'])

/**
 * Entorno del main:
 * - `process.env`: solo si la app se lanza con la variable en el shell.
 * - `import.meta.env` (electron-vite v6 + vite v8): los `.env` con prefijo
 *   `MAIN_VITE_` NO existen en el `process.env` del main ni sobreviven como
 *   referencias `process.env.X` en el build SSR — se inyectan por definición
 *   en tiempo de compilación y solo se leen con notación de punto.
 *   (Incidente 1, docs/DEPENDENCIAS.md 24/10/2026.)
 */
const mainEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env

export function resolveDataMode(): DATA_MODE {
  const raw =
    process.env['MAIN_VITE_DATA_MODE'] ??
    mainEnv?.MAIN_VITE_DATA_MODE
  if (!raw) return 'demo-local'
  const parsed = dataModeSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error(
      `MAIN_VITE_DATA_MODE inválido: "${raw}". Valores: demo-local, demo-api, connected`
    )
  }
  return parsed.data
}

export const API_BASE_URL =
  process.env['MAIN_VITE_ANALYTICS_API_URL'] ??
  mainEnv?.MAIN_VITE_ANALYTICS_API_URL ??
  'http://127.0.0.1:8000'
