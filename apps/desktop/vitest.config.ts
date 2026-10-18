import { defineConfig } from 'vitest/config'

/**
 * Config solo para pruebas (vitest run con entorno Node): valida el fixture
 * canónico y las reglas puras. No afecta al build de electron-vite (ambos
 * configs conviven; electron-vite usa electron.vite.config.ts).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
