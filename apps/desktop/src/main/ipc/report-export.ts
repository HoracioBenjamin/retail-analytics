import { dialog, ipcMain, Notification } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import type { ReportPdfResult } from '../../shared/report-export'

// Los donuts usan SVG con viewBox fijo. Los otros gráficos se preparan al
// ancho del papel, sin conectar el depurador a la ventana del usuario.
function enterExportModeScript(preview: string): string {
  return `
    (async () => {
      const image = document.createElement('img');
      image.src = ${JSON.stringify(preview)};
      image.alt = '';
      await image.decode();
      const cover = document.createElement('div');
      cover.id = 'report-export-cover';
      cover.className = 'report-export-cover';
      cover.tabIndex = -1;
      cover.setAttribute('role', 'status');
      cover.setAttribute('aria-label', 'Preparando PDF');
      cover.appendChild(image);
      const status = document.createElement('span');
      status.className = 'report-export-cover-status';
      status.textContent = 'Preparando PDF…';
      cover.appendChild(status);
      cover.addEventListener('keydown', event => event.preventDefault());
      window.__reportExportView = {
        x: window.scrollX, y: window.scrollY,
        focus: document.activeElement,
        scroll: [...document.querySelectorAll('.one-main')].map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }))
      };
      document.body.appendChild(cover);
      cover.focus({ preventScroll: true });
      window.scrollTo(0, 0);
      document.documentElement.classList.add('report-export-mode');
    })()
  `
}
const EXIT_EXPORT_MODE_SCRIPT = `
  (() => {
  document.documentElement.classList.remove('report-export-mode');
  const view = window.__reportExportView;
  if (view) {
    window.scrollTo(view.x, view.y);
    for (const { node, top, left } of view.scroll) {
      if (node.isConnected) { node.scrollTop = top; node.scrollLeft = left; }
    }
    if (view.focus?.isConnected) view.focus.focus({ preventScroll: true });
    delete window.__reportExportView;
  }
  document.getElementById('report-export-cover')?.remove();
  })()
`
const WAIT_FOR_PRINT_LAYOUT_SCRIPT = `
  (async () => {
    await document.fonts.ready;
    let previous = '';
    let stable = 0;
    const deadline = performance.now() + 8000;
    while (performance.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 80));
      const charts = [...document.querySelectorAll('.report-page .recharts-wrapper')];
      const measurements = charts.flatMap(container => {
        const bounds = container.getBoundingClientRect();
        if (bounds.width <= 0 || bounds.height <= 0) return [];
        const svg = container.querySelector('svg.recharts-surface');
        const rendered = svg?.getBoundingClientRect();
        return [[bounds.width, bounds.height, rendered?.width ?? 0, rendered?.height ?? 0]];
      });
      // Recharts usa elementos de tamaño cero y overflow visible internamente.
      // El SVG y el contenedor responsive no tienen por qué medir lo mismo.
      // Comprobar el gráfico real y su estabilidad, sin exigir esa igualdad.
      const ready = measurements.every(([w, h, sw, sh]) => w > 0 && h > 0 && sw > 0 && sh > 0);
      const signature = JSON.stringify(measurements);
      stable = ready && signature === previous ? stable + 1 : 0;
      previous = signature;
      if (stable >= 4) return;
    }
    throw new Error('Los gráficos no terminaron de ajustar su tamaño para el PDF.');
  })()
`

export function registerReportExportIpc(getWindow: () => Electron.BrowserWindow | null): void {
  ipcMain.handle('reports:saveCurrentAsPdf', async (event): Promise<ReportPdfResult> => {
    const window = getWindow()
    if (!window || window.webContents !== event.sender) {
      return { ok: false, error: 'No se pudo validar la ventana de la aplicación.' }
    }

    let exportMode = false
    let stage: 'prepare' | 'print' | 'save' = 'prepare'
    try {
      const currentRoute: string =
        await window.webContents.executeJavaScript('window.location.hash')
      if (!/^#\/reports(?:\?|$)/.test(currentRoute)) {
        return { ok: false, error: 'Abre el módulo de Reportes antes de exportar.' }
      }

      // Mantener en pantalla la vista actual mientras se ajusta el reporte.
      // La cubierta se excluye por CSS del PDF y no abre ninguna ventana.
      const preview = await window.webContents.capturePage()
      exportMode = true
      await window.webContents.executeJavaScript(enterExportModeScript(preview.toDataURL()))
      await window.webContents.executeJavaScript(WAIT_FOR_PRINT_LAYOUT_SCRIPT)

      stage = 'print'
      const pdf = await window.webContents.printToPDF({
        pageSize: 'A4',
        preferCSSPageSize: true,
        printBackground: true,
        landscape: false,
        // 12mm = el mismo margen de @page en globals.css: así el área de
        // contenido impresa (≈703px) coincide EXACTO con el modo de
        // exportación y las medidas de los gráficos re-renderizados calzan.
        margins: { top: 0.47244, bottom: 0.47244, left: 0.47244, right: 0.47244 }
      })
      await window.webContents.executeJavaScript(EXIT_EXPORT_MODE_SCRIPT)
      exportMode = false
      stage = 'save'
      const { canceled, filePath } = await dialog.showSaveDialog(window, {
        title: 'Guardar reporte de métricas en PDF',
        defaultPath: `reporte-general-${new Date().toISOString().slice(0, 10)}.pdf`,
        filters: [{ name: 'Documento PDF', extensions: ['pdf'] }]
      })
      if (canceled || !filePath) return { ok: true, canceled: true }

      const outputPath = extname(filePath).toLowerCase() === '.pdf' ? filePath : `${filePath}.pdf`
      await writeFile(outputPath, pdf)
      // Notificación nativa de Windows: confirmación explícita del guardado.
      // Requiere el appUserModelId ya fijado en el arranque de la app.
      try {
        if (Notification.isSupported()) {
          new Notification({
            title: 'Reporte guardado',
            body: `El PDF se guardó correctamente: ${basename(outputPath)}`
          }).show()
        }
      } catch (notificationError) {
        console.warn(
          '[reports] PDF guardado; no se pudo mostrar la notificación:',
          notificationError
        )
      }
      return { ok: true, canceled: false, fileName: basename(outputPath) }
    } catch (error) {
      console.error(`[reports] Fallo en ${stage}:`, error)
      return {
        ok: false,
        error:
          stage === 'prepare'
            ? 'No se pudo preparar el reporte para imprimir. Espera a que los gráficos terminen de cargar e inténtalo otra vez.'
            : stage === 'print'
              ? 'No se pudo generar el PDF con el servicio de impresión. Reinicia la aplicación e inténtalo otra vez.'
              : 'El PDF se generó, pero no se pudo guardar. Elige otra ubicación o cierra el archivo si está abierto.'
      }
    } finally {
      if (exportMode) {
        await window.webContents.executeJavaScript(EXIT_EXPORT_MODE_SCRIPT).catch(() => undefined)
      }
    }
  })
}
