import { ipcMain } from 'electron'
import { z, ZodError } from 'zod'
import type { AnalyticsApi, ApiErrorEnvelope } from '../../shared/contracts'
import { filtersSchema } from '../../shared/schemas'
import { NotFoundVariantError } from '../services/demo-local'
import { ProviderValidationError } from '../services/provider'

/**
 * Registro del puente IPC limitado (plan, Paso 3):
 * - Cada handler valida el emisor: solo acepta frames de las ventanas de la app.
 * - Todos los parámetros se validan con zod; el renderer no puede pasar
 *   objetos Node, rutas de disco, SQL ni invocaciones arbitrarias.
 * - Los fallos se devuelven como sobre tipado { ok:false, error:{code,message} }
 *   (sección 9.4 del plan: códigos y mensajes estables, nunca silenciosos).
 */

function errorEnvelope(code: string, message: string): ApiErrorEnvelope {
  return { ok: false, error: { code, message } as ApiErrorEnvelope['error'] }
}

const variantIdSchema = z.string().min(1).max(120)

type IpcEvent = Electron.IpcMainEvent | Electron.IpcMainInvokeEvent

export function registerAnalyticsIpc(
  provider: AnalyticsApi,
  getWindow: () => Electron.BrowserWindow | null
): void {
  const senderOk = (event: IpcEvent): boolean => getWindow()?.webContents === event.sender

  const withValidation = <S extends z.ZodTypeAny>(
    schema: S,
    handler: (validated: z.output<S>, _event: IpcEvent) => Promise<unknown> | unknown
  ): ((event: IpcEvent, ...args: unknown[]) => Promise<unknown>) => {
    return async (event, ...args: unknown[]) => {
      try {
        if (!senderOk(event)) {
          return errorEnvelope('IPC_REJECTED', 'Emisor IPC no autorizado')
        }
        // zod valida el tuple completo de parámetros antes de tocar el provider.
        const validated = schema.parse(args) as z.output<S>
        return await handler(validated, event)
      } catch (issue) {
        if (issue instanceof NotFoundVariantError) {
          return errorEnvelope('NOT_FOUND', issue.message)
        }
        if (issue instanceof ProviderValidationError) {
          return errorEnvelope(issue.code, issue.message)
        }
        if (issue instanceof ZodError) {
          return errorEnvelope(
            'VALIDATION_ERROR',
            `Parámetros IPC inválidos: ${issue.issues[0]?.message}`
          )
        }
        console.error('[ipc] error interno:', issue)
        return errorEnvelope('SERVICE_UNAVAILABLE', 'Error interno del servicio analítico')
      }
    }
  }

  ipcMain.handle(
    'analytics:getOverview',
    withValidation(z.tuple([filtersSchema]), ([filters]) => provider.getOverview(filters))
  )
  ipcMain.handle(
    'analytics:getFilters',
    withValidation(z.tuple([]), () => provider.getFilters())
  )
  ipcMain.handle(
    'analytics:listVariants',
    withValidation(z.tuple([filtersSchema]), ([filters]) => provider.listVariants(filters))
  )
  ipcMain.handle(
    'analytics:getVariant',
    withValidation(z.tuple([variantIdSchema]), ([variantId]) => provider.getVariant(variantId))
  )
  ipcMain.handle(
    'analytics:getForecasts',
    withValidation(z.tuple([filtersSchema]), ([filters]) => provider.getForecasts(filters))
  )
  ipcMain.handle(
    'analytics:getRecommendations',
    withValidation(z.tuple([filtersSchema]), ([filters]) => provider.getRecommendations(filters))
  )
  ipcMain.handle(
    'analytics:getDataStatus',
    withValidation(z.tuple([z.boolean().optional()]), ([forceRefresh]) =>
      provider.getDataStatus(forceRefresh)
    )
  )
}
