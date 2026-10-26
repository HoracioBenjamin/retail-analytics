/// <reference types="vite/client" />

/** Variables de entorno del renderer (prefijos MAIN_VITE_ de electron-vite). */
interface ImportMetaEnv {
  /** Modo de datos definido en el proceso main (info visible en Ajustes). */
  readonly MAIN_VITE_DATA_MODE?: string
  /** URL de FastAPI para los modos demo-api y connected. */
  readonly MAIN_VITE_ANALYTICS_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
