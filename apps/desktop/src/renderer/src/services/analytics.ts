import type { AnalyticsApi } from '@shared/contracts'
import type { ApiError, Pagination, ResponseMeta } from '@shared/schemas'

/**
 * Acceso tipado al puente IPC desde el renderer (plan, Paso 3 y 5):
 * el renderer solo interactúa con esta interfaz y no conoce los canales
 * IPC ni los objetos Node. Todo resultado pasa por el sobre del plan
 * (sección 9.4): { ok:true, data, meta, pagination? } | { ok:false, error }.
 */
export const analyticsApi: AnalyticsApi = window.analyticsApi

/** Error tipado del renderer a partir del sobre de error estable. */
export class ApiCallError extends Error {
  constructor(
    public readonly code: ApiError['code'],
    message: string
  ) {
    super(message)
  }
}

interface OkEnvelope<T> {
  ok: true
  data: T
  meta: ResponseMeta
  pagination?: Pagination
}

type ErrorEnvelope = { ok: false; error: ApiError }

/**
 * Convierte el sobre del puente en valor o en ApiCallError (para que
 * react-query clasifique el estado de la pantalla). Nunca silencia: si
 * el code es VALIDATION_ERROR llega con su mensaje estable.
 */
export async function callOk<T>(promise: Promise<OkEnvelope<T> | ErrorEnvelope>): Promise<{
  data: T
  meta: ResponseMeta
  pagination?: Pagination
}> {
  const res = await promise
  if (!res.ok) {
    throw new ApiCallError(res.error.code, res.error.message)
  }
  return { data: res.data, meta: res.meta, pagination: res.pagination }
}
