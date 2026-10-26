import { resolve } from 'path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/** Versión única desde package.json para mostrarla en Ajustes. */
const APP_VERSION: string = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
  .version as string

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    define: {
      APP_VERSION: JSON.stringify(APP_VERSION)
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
