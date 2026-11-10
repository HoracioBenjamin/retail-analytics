// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import type { ReportPdfResult } from '../../shared/report-export'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  save: vi.fn(),
  write: vi.fn()
}))
vi.mock('electron', () => ({
  ipcMain: { handle: mocks.handle },
  dialog: { showSaveDialog: mocks.save },
  Notification: { isSupported: () => false }
}))
vi.mock('node:fs/promises', () => ({ writeFile: mocks.write }))
import { registerReportExportIpc } from './report-export'

function setup(): {
  contents: {
    executeJavaScript: Mock<(script: string) => Promise<string | undefined>>
    printToPDF: Mock
    capturePage: Mock
  }
  run: () => Promise<ReportPdfResult>
} {
  const contents = {
    executeJavaScript: vi.fn(async (script: string) =>
      script === 'window.location.hash' ? '#/reports' : undefined
    ),
    printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf')),
    capturePage: vi
      .fn()
      .mockResolvedValue({ toDataURL: () => 'data:image/png;base64,cHJldmlldw==' })
  }
  registerReportExportIpc(() => ({ webContents: contents }) as unknown as Electron.BrowserWindow)
  const handler = mocks.handle.mock.calls.at(-1)![1]
  return { contents, run: () => handler({ sender: contents }) }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.write.mockReset()
  mocks.save.mockResolvedValue({ canceled: true })
})

describe('exportación PDF', () => {
  it('prepara gráficos sin depurador y restaura la pantalla al cancelar el guardado', async () => {
    const { contents, run } = setup()
    expect(await run()).toEqual({ ok: true, canceled: true })
    expect(contents.executeJavaScript.mock.invocationCallOrder[2]).toBeLessThan(
      contents.printToPDF.mock.invocationCallOrder[0]
    )
    expect(contents.executeJavaScript.mock.invocationCallOrder[3]).toBeLessThan(
      mocks.save.mock.invocationCallOrder[0]
    )
    expect(mocks.write).not.toHaveBeenCalled()
    expect(contents.capturePage.mock.invocationCallOrder[0]).toBeLessThan(
      contents.executeJavaScript.mock.invocationCallOrder[1]
    )
  })

  it('restaura estilos y distingue un fallo de impresión de permisos de escritura', async () => {
    const { contents, run } = setup()
    contents.printToPDF.mockRejectedValue(new Error('fallo de impresión'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const result = await run()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('servicio de impresión')
      expect(contents.executeJavaScript.mock.calls.at(-1)![0]).toContain(
        "classList.remove('report-export-mode')"
      )
      expect(mocks.save).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  })

  it('no guarda un PDF si los gráficos no terminan de ajustar su tamaño', async () => {
    const { contents, run } = setup()
    contents.executeJavaScript.mockImplementation(async (script: string) => {
      if (script.includes('document.fonts.ready')) throw new Error('gráficos sin ajustar')
      return script === 'window.location.hash' ? '#/reports' : undefined
    })
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect((await run()).ok).toBe(false)
      expect(contents.printToPDF).not.toHaveBeenCalled()
      expect(mocks.save).not.toHaveBeenCalled()
      expect(contents.executeJavaScript.mock.calls.at(-1)![0]).toContain(
        "classList.remove('report-export-mode')"
      )
    } finally {
      log.mockRestore()
    }
  })

  it('acepta dimensiones porcentuales de SVG y omite contenedores ocultos', async () => {
    const { contents, run } = setup()
    await run()
    const script = contents.executeJavaScript.mock.calls.find(([code]) =>
      code.includes('document.fonts.ready')
    )![0]
    const svg = {
      getAttribute: () => '100%',
      getBoundingClientRect: () => ({ width: 703, height: 215 })
    }
    const document = {
      fonts: { ready: Promise.resolve() },
      querySelectorAll: () => [
        { getBoundingClientRect: () => ({ width: 703, height: 215 }), querySelector: () => svg },
        { getBoundingClientRect: () => ({ width: 0, height: 0 }), querySelector: () => null }
      ]
    }
    let now = 0
    const evaluate = new Function(
      'document',
      'setTimeout',
      'performance',
      'return (' + script.trim() + ')'
    )
    await expect(
      evaluate(document, (callback: () => void) => callback(), { now: () => (now += 100) })
    ).resolves.toBeUndefined()
  })

  it('informa un fallo al guardar solo después de generar el PDF', async () => {
    const { contents, run } = setup()
    mocks.save.mockResolvedValue({ canceled: false, filePath: 'reporte.pdf' })
    mocks.write.mockRejectedValue(new Error('EACCES'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      const result = await run()
      expect(contents.printToPDF).toHaveBeenCalledOnce()
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.error).toContain('se generó, pero no se pudo guardar')
    } finally {
      log.mockRestore()
    }
  })

  it('no bloquea la descarga si un SVG estable mide distinto a su contenedor', async () => {
    const { contents, run } = setup()
    mocks.save.mockResolvedValue({ canceled: false, filePath: 'reporte.pdf' })
    contents.executeJavaScript.mockImplementation(async (script: string) => {
      if (script === 'window.location.hash') return '#/reports'
      if (script.includes('document.fonts.ready')) {
        const document = {
          fonts: { ready: Promise.resolve() },
          querySelectorAll: (selector: string) => {
            // La estructura de Recharts no garantiza igualdad de dimensiones.
            expect(selector).toBe('.report-page .recharts-wrapper')
            return [
              {
                getBoundingClientRect: () => ({ width: 703, height: 215 }),
                querySelector: () => ({
                  getBoundingClientRect: () => ({ width: 640, height: 198 })
                })
              }
            ]
          }
        }
        let now = 0
        const evaluate = new Function(
          'document',
          'setTimeout',
          'performance',
          'return (' + script.trim() + ')'
        )
        await evaluate(document, (callback: () => void) => callback(), { now: () => (now += 100) })
      }
      return undefined
    })
    expect(await run()).toEqual({ ok: true, canceled: false, fileName: 'reporte.pdf' })
    expect(contents.printToPDF).toHaveBeenCalledOnce()
    expect(mocks.write).toHaveBeenCalledWith('reporte.pdf', Buffer.from('pdf'))
  })

  it('mantiene la vista durante la preparación y restaura foco y desplazamiento', async () => {
    const { contents, run } = setup()
    await run()
    const entry = contents.executeJavaScript.mock.calls[1][0]
    const exit = contents.executeJavaScript.mock.calls[3][0]
    document.body.innerHTML =
      '<button id="download">Descargar PDF</button><main class="one-main"></main>'
    const button = document.getElementById('download')!
    const main = document.querySelector('.one-main')!
    button.focus()
    main.scrollTop = 480
    const decode = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'decode')
    Object.defineProperty(HTMLImageElement.prototype, 'decode', {
      configurable: true,
      value: async () => undefined
    })
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined)
    try {
      await new Function('window', 'document', 'return (' + entry.trim() + ')')(window, document)
      const cover = document.getElementById('report-export-cover')!
      expect(cover.textContent).toBe('Preparando PDF…')
      expect(cover.querySelector('img')?.src).toBe('data:image/png;base64,cHJldmlldw==')
      expect(document.activeElement).toBe(cover)
      main.scrollTop = 0
      new Function('window', 'document', exit)(window, document)
      expect(document.getElementById('report-export-cover')).toBeNull()
      expect(document.documentElement.classList.contains('report-export-mode')).toBe(false)
      expect(main.scrollTop).toBe(480)
      expect(document.activeElement).toBe(button)
    } finally {
      scroll.mockRestore()
      if (decode) Object.defineProperty(HTMLImageElement.prototype, 'decode', decode)
      else Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
      document.body.innerHTML = ''
    }
  })
})
