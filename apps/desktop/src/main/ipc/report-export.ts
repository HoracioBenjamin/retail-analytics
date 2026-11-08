import { dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { ReportPdfResult } from '../../shared/report-export'

export function registerReportExportIpc(getWindow: () => Electron.BrowserWindow | null): void {
  ipcMain.handle('reports:saveCurrentAsPdf', async (event): Promise<ReportPdfResult> => {
    const window = getWindow()
    if (!window || window.webContents !== event.sender) {
      return { ok: false, error: 'No se pudo validar la ventana de la aplicación.' }
    }

    try {
      const currentRoute: string =
        await window.webContents.executeJavaScript('window.location.hash')
      if (!/^#\/reports(?:\?|$)/.test(currentRoute)) {
        return { ok: false, error: 'Abre el módulo de Reportes antes de exportar.' }
      }

      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: 'Guardar reporte de métricas en PDF',
        defaultPath: `reporte-general-${new Date().toISOString().slice(0, 10)}.pdf`,
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return { ok: true, canceled: true }

      const outputPath = extname(filePath).toLowerCase() === '.pdf' ? filePath : `${filePath}.pdf`
      const pdf = await window.webContents.printToPDF({
        pageSize: 'A4',
        printBackground: true,
        landscape: false,
        margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }
      })
      await writeFile(outputPath, pdf)
      return { ok: true, canceled: false, fileName: basename(outputPath) }
    } catch (error) {
      console.error('[reports] No se pudo generar el PDF:', error)
      return {
        ok: false,
        error:
          'No se pudo generar el PDF. Comprueba los permisos de escritura e inténtalo otra vez.'
      }
    }
  })
}
