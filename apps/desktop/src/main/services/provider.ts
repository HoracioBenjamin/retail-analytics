import type { AnalyticsApi } from '../../shared/contracts'

/**
 * Interfaz común de datos (plan, Paso 3 punto 5).
 * El main selecciona el proveedor activo según el modo de datos:
 * - demo-local: fixture local (Entrega A).
 * - demo-api: HTTP contra FastAPI (Entrega B, Paso 7).
 * - connected: NO disponible en A/B — debe fallar de forma explícita.
 */
export interface DataProvider extends AnalyticsApi {
  readonly mode: 'demo-local' | 'demo-api' | 'connected'
}

/**
 * Error de dominio con código estable (plan 9.4). El bridge lo convierte
 * en sobre { ok:false, error } sin perder el código al cruzar el canal.
 */
export class ProviderValidationError extends Error {
  constructor(
    message: string,
    public readonly code: 'VALIDATION_ERROR' | 'NOT_FOUND'
  ) {
    super(message)
  }
}
