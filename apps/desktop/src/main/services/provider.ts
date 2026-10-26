import type { AnalyticsApi } from '../../shared/contracts'

/**
 * Interfaz común de datos (plan, Paso 3 punto 5).
 * El main selecciona el proveedor activo según el modo de datos:
 * - demo-local: fixture local (Entrega A).
 * - demo-api: HTTP contra FastAPI (Entrega B, Paso 7).
 * - connected: FastAPI consulta Supabase con clave pública y respeta RLS.
 */
export interface DataProvider extends AnalyticsApi {
  readonly mode: 'demo-local' | 'demo-api' | 'connected'
}

/**
 * Error de dominio con código estable (plan 9.4 + etapa C). El bridge lo
 * convierte en sobre { ok:false, error } sin perder el código al cruzar el
 * canal. PERMISSION_DENIED = RLS bloqueó la lectura (nunca se bypasea).
 */
export class ProviderValidationError extends Error {
  constructor(
    message: string,
    public readonly code:
      'VALIDATION_ERROR' | 'NOT_FOUND' | 'SERVICE_UNAVAILABLE' | 'PERMISSION_DENIED'
  ) {
    super(message)
  }
}
