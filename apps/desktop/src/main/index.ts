import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { electronApp, optimizer } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { resolveDataMode } from './config/settings'
import { DemoLocalProvider } from './services/demo-local'
import { registerAnalyticsIpc } from './ipc/bridge'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Especificación del plan (sección 7.2): primera ventana 1440×900,
  // mínimo 1100×720; barra de título nativa de Windows inicialmente.
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    title: 'Zapatillas Duoc Analytics',
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // Renderer sandboxed (guía de seguridad de Electron, plan Paso 3).
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function bootServices(): void {
  const mode = resolveDataMode()
  if (mode === 'demo-api' || mode === 'connected') {
    // El plan exige que los modos no implementados fallen de forma explícita.
    // demo-api se implementa en el Paso 7 (Entrega B); connected es etapa posterior.
    throw new Error(
      `El modo de datos "${mode}" no está implementado todavía. ` +
        'Usa MAIN_VITE_DATA_MODE=demo-local (valores válidos: demo-local, demo-api [Paso 7], connected [etapa posterior]).'
    )
  }
  const provider = new DemoLocalProvider()
  registerAnalyticsIpc(provider, () => mainWindow)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.duocuc.zapatillas-duoc-analytics')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  try {
    bootServices()
  } catch (error) {
    console.error('[main] Falló el arranque de servicios:', error)
    app.quit()
    return
  }

  createWindow()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
