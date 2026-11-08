import { contextBridge, ipcRenderer } from 'electron'
import type { AnalyticsApi } from '../shared/contracts'
import type { ReportExportApi } from '../shared/report-export'

/**
 * Preload tipado y limitado (plan, Paso 3):
 * - Solo expone los métodos del contrato AnalyticsApi mediante contextBridge.
 * - NO expone ipcRenderer completo ni un ejecutor genérico de comandos ni
 *   invocaciones arbitrarias: cada canal es fijo y validado en main.
 * - Todos los resultados/fallos viajan en sobre tipado { ok, data|error }.
 */
const api: AnalyticsApi = {
  getOverview: (filters) => ipcRenderer.invoke('analytics:getOverview', filters),
  getFilters: () => ipcRenderer.invoke('analytics:getFilters'),
  listVariants: (filters) => ipcRenderer.invoke('analytics:listVariants', filters),
  getVariant: (variantId) => ipcRenderer.invoke('analytics:getVariant', variantId),
  getForecasts: (filters) => ipcRenderer.invoke('analytics:getForecasts', filters),
  getRecommendations: (filters) => ipcRenderer.invoke('analytics:getRecommendations', filters),
  getDataStatus: (forceRefresh) => ipcRenderer.invoke('analytics:getDataStatus', forceRefresh)
}

const reportApi: ReportExportApi = {
  saveCurrentReportAsPdf: () => ipcRenderer.invoke('reports:saveCurrentAsPdf')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('analyticsApi', api)
    contextBridge.exposeInMainWorld('reportExportApi', reportApi)
  } catch (error) {
    console.error(error)
  }
} else {
  // Sandbox/modo sin aislamiento: asignación directa con cast explícito.
  ;(window as unknown as { analyticsApi: AnalyticsApi }).analyticsApi = api
  ;(window as unknown as { reportExportApi: ReportExportApi }).reportExportApi = reportApi
}
