# Dependencias y entorno — Zapatillas Duoc Analytics

Fecha de registro: 17 de octubre de 2026 (Paso 0 del `PLAN_BASE_SOFTWARE_PREDICTIVO.md`).

Este documento registra la plataforma, las herramientas verificadas y las decisiones de gestión de dependencias para la construcción de la base del aplicativo predictivo de escritorio.

## 1. Plataforma de trabajo

| Ítem | Decisión |
|---|---|
| Sistema donde corre Electron | **Windows 10/11 de 64 bits** (confirmado como supuesto del plan; la ventana y el instalador se prueban aquí). |
| Ruta del proyecto (Windows) | `C:\Users\practica.pti\Documents\0.Duoc Uc\retail-analytics-desktop` |
| Ruta equivalente (WSL) | `/mnt/c/Users/practica.pti/Documents/0.Duoc Uc/retail-analytics-desktop` |
| Proyecto de referencia visual | `C:\Users\practica.pti\Documents\procesos_automaticos` — **solo lectura**; se conserva sin modificaciones. |

## 2. Herramientas verificadas en Windows (sistema de Electron)

Verificación real ejecutada el 17/10/2026 mediante PowerShell:

```
node --version     → v22.17.1
npm --version      → 10.9.2
git --version      → git version 2.49.0.windows.1
py -3.12 --version → Python 3.12.4
```

Notas:

- Node 22.17.1 es una versión de la línea 22 (LTS). La compatibilidad exacta se confirmará con los `engines` del generador electron-vite en el Paso 1; si exige otra LTS, se ajusta y se registra aquí.
- El launcher `py` de Windows con Python 3.12.4 permite crear el `.venv` del backend en el Paso 6 (Entrega B).
- Contraste en WSL (no es el sistema objetivo): Node `v22.23.2`, npm `10.9.8`, Python `3.12.3`.

## 3. Estado previo del destino

- `retail-analytics-desktop/` no existía antes del Paso 0 (se creó en esta sesión junto a `docs/`): **no hay trabajo previo que preservar**.
- La raíz del proyecto cuenta con un **`AGENTS.md`** (creado el 17/10/2026) orientado a cualquier IA o persona que continúe el desarrollo: identifica documentos de referencia, prohibiciones, alcance de las Entregas A/B y flujo de trabajo.
- No existía ningún `AGENTS.md` previo en la carpeta de destino ni en sus carpetas madre revisadas.
- La tienda Next.js, el dashboard Ionic, `procesos_automaticos` y Supabase permanecen **intactos** y fuera del alcance de las Entregas A y B.
- El repositorio Git existente es el de la carpeta `0.Duoc Uc` (carpeta madre); este plan no crea repositorios anidados automáticamente (sección 5.1 del plan).

## 4. Decisiones de gestión de dependencias

| Tema | Decisión | Motivo |
|---|---|---|
| Gestor JavaScript | npm (único) | Fijado por el plan; un solo `package-lock.json` por aplicación. |
| `node_modules` | **Por sistema operativo**; nunca compartidos entre Windows y WSL | Los binarios nativos no son portables entre sistemas; se regeneran con `npm ci` al cambiar de entorno. |
| `.venv` de Python | Por proyecto, en `services/analytics-api/.venv` | Se crea en el Paso 6, no antes. |
| Lock de Python | `requirements.lock.txt` generado con pip-tools | Se genera en el Paso 6, no antes; no se editan pins a mano. |
| Repositorios anidados | No se crean en este plan | El plan lo prohíbe explícitamente; se usa el repositorio que el equipo ya tenga. |
| Instalaciones forzadas | Prohibido `--force` y `--legacy-peer-deps` | Se resuelven los conflictos reales de versiones y se registran. |
| TLS | No se desactiva jamás (`NODE_TLS_REJECT_UNAUTHORIZED=0` prohibido) | El plan lo prohíbe; tampoco se copia el script `dev` del proyecto de procesos. |

## 5. Preparación para GitHub y portabilidad

- `.gitattributes` con finales de línea normalizados evita el ruido CRLF/LF entre Windows y WSL.
- `.gitignore` excluye `node_modules/`, `.venv/`, `.env`, artefactos de build y salida de electron-builder.
- El código fuente es portable: al clonar en otra máquina, `npm ci` y — para la Entrega B — `pip install -r requirements.lock.txt` reconstruyen el entorno local.

## 6. Registro de ejecución por pasos

### Paso 1 — Scaffolding de escritorio (COMPLETADO, 17/10/2026)

**Resultados reales:**

- El generador interactivo `npm create @quick-start/electron@latest desktop -- --template react-ts` **no completó el scaffolding de forma no interactiva** (los prompts "Select a framework" y "Add Electron updater plugin?" quedaron sin respuesta y el template quedó incompleto). La doc oficial contrastada (`electron-vite.org/guide`) permite el alterno documentado: **degit del template oficial** `alex8088/quick-start/packages/create-electron/playground/react-ts`. Se usó ese camino y el resultado es equivalente al preset `react-ts`.
- Template completo generado en `retail-analytics-desktop/apps/desktop/` con separación `src/main`, `src/preload`, `src/renderer`.
- `npm install` en Windows (cmd.exe): **551 paquetes instalados**, sin usar `--force` ni `--legacy-peer-deps`. npm reporta 8 vulnerabilidades de severidad moderada; se registra sin ocultarlas (no se ejecutó `audit fix --force`, prohibido por el plan).

**Versiones realmente resueltas** (del lock generado, superan los `^` del template):

| Paquete | Versión resuelta |
|---|---|
| electron-vite | **6.0.0** (la doc web mostraba 5.0.0; el template ya usa la v6) |
| Electron | **44.9.0** |
| Vite | **8.3.4** |
| React / React DOM | **19.3.0** |
| TypeScript | **5.9.3** |
| ESLint | **9.39.5** |
| electron-builder | **26.15.3** |

- Node 22.17.1 cumple el requisito declarado por electron-vite (`20.19+ / 22.12+`). Compatibilidad confirmada en la práctica.

**Verificación de la ventana:**

- `npm run dev` ejecutado vía Windows: build de main (1.57 kB) y preload (0.47 kB) exitoso, dev server del renderer iniciado, y **el usuario confirmó visualmente la ventana Electron abierta** en el escritorio de Windows.
- Procesos de prueba **cerrados de forma normal** al terminar (0 procesos electron restantes).

**Observaciones registradas para el Paso 3:**

- El template genera `sandbox: false` en `webPreferences` y expone `ipcMain.on('ping')` de prueba → el Paso 3 deberá ajustar el sandbox del renderer según la guía de seguridad de Electron y sustituir el IPC de ejemplo por el puente limitado del proyecto.
- El `typecheck` del generador separa main (`tsconfig.node.json`) y renderer (`tsconfig.web.json`); el plan pide normalizar después los scripts `dev/lint/typecheck/test:run/build` (sección 14).

### Paso 2 — Instalar las dependencias de interfaz (COMPLETADO, 17/10/2026)

**Instalaciones ejecutadas (todas vía Windows/cmd.exe):**

- Dependencias de aplicación: `react-router-dom`, `@tanstack/react-query`, `@tanstack/react-table`, `recharts`, `lucide-react`, `zod`, `clsx`, `tailwind-merge`, `class-variance-authority` + (añadidas por la CLI de shadcn) `radix-ui` (monopaquete), `cn` (`^0.5.0`, utilitario `cn()` que usan los componentes generados; se confundió con un duplicado al inicio y se restauró tras el error de typecheck).
- Dependencias de desarrollo: `tailwindcss` `^4.3.3`, `@tailwindcss/vite` `^4.3.3`, `tw-animate-css` (requerido por los estilos shadcn sobre Tailwind 4), `vitest` `^5.0.5`, `@testing-library/react` `^16.3.3`, `@testing-library/jest-dom` `^29.1.1-dev`, `jsdom`.
- `npm audit` reporta **8 vulnerabilidades moderadas** persistentes; se registran sin aplicar `--force` (prohibido por el plan); se revisarán al finalizar la base con `npm audit` normal.

**Versiones resueltas clave:** zod `4.6.7` · react-router-dom `7.18.4` · recharts `3.10.1` · Tailwind `4.3.3` · radix-ui `1.8.1` · vitest `5.0.5`.

**Configuración aplicada:**

1. `electron.vite.config.ts`: plugin `tailwindcss()` **solo en renderer** + alias `@` → `src/renderer/src` (se conserva `@renderer`).
2. `tsconfig.web.json` y `tsconfig.json` (raíz): paths de `@` y `@renderer`; el de la raíz existe para que la CLI de shadcn resuelva alias contra la estructura de referencias contestable del generador.
3. `components.json` (new-york, sin server components, CSS en `src/renderer/src/styles/globals.css`).
4. `src/renderer/src/styles/globals.css` con `@import "tailwindcss"`, tema neutral shadcn (oklch) incluyendo variables chart/sidebar, y la base `@layer` estándar.
5. `src/renderer/src/lib/utils.ts` con `cn()` (clsx + tailwind-merge).
6. Componentes shadcn instalados con la CLI (`npx shadcn@latest add -y -o ...`): button, card, badge, input, select, table, tabs, tooltip, dropdown-menu, sheet, skeleton, separator, switch, alert, collapsible → `src/renderer/src/components/ui/`.
7. Limpieza del código de ejemplo del generador: eliminados `Versions.tsx`, `assets/{base,main}.css`, `assets/{electron,wavy-lines}.svg`; `main.tsx` importa `'@/styles/globals.css'`; `App.tsx` temporal de prueba con dos `Button` de shadcn (se sustituye en el Paso 4).

**Verificaciones del paso (reales):**

- `npm run typecheck` ✅ (main y renderer, sin errores).
- `npm run lint` ✅ tras dos ajustes documentados: `npm run format` (prettier) corrigió los avisos de formato; y se añadió a `eslint.config.mjs` una excepción **acotada solo** a `src/renderer/src/components/ui/**` (código vendido de shadcn): `explicit-function-return-type` y `react-refresh/only-export-components` deshabilitadas, porque el estilo stock de shadcn no las cumple; el código propio mantiene las reglas estrictas.
- `npm run dev` y `npm run start` (preview): build compila y **el usuario confirmó visualmente la ventana con los dos botones shadcn** (título "Zapatillas Duoc Analytics", fondo blanco, botones primario/outline).

**Incidente documentado (causa raíz y lección):**

- Síntoma: `electron.exe` moría instantáneo con `crashpad not connected` (exit 3) en todos los modos, aunque los builds compilaran; el visor de eventos no mostró crash report.
- Causa: un `npm install` ejecutado temporalmente **desde WSL** (durante las verificaciones de `cn`) hizo que el postinstall `install-electron` detectara Linux y descargara parcialmente el dist de Linux de Electron, dejando `node_modules/electron/dist` corrupto (mezcla de binarios Windows y Linux, sin `crashpad_handler.exe` de Windows).
- Reparación: eliminado el dist corrupto y regenerado con `node node_modules\electron\install.js` desde Windows → dist Windows limpio de electron 44.9.0; verificación con arranque directo sostenido (4 procesos electron, 0 errores en log) y confirmación visual del usuario.
- Lección consolidada (ya prevista en el plan, sección 5.1): **todas las operaciones npm de este proyecto se ejecutan desde Windows** (`cmd.exe`/PowerShell). WSL queda para el backend Python de la Entrega B, nunca para instalar dependencias del renderer/Electron.

### Paso 3 — Fijar los límites de Electron y los servicios (IMPLEMENTADO, 17/10/2026 — confirmación visual pendiente del usuario)

**Estructura creada (cumpliendo el alcance del plan, nada de etapas futuras):**

```text
apps/desktop/src/
├── shared/            ← contratos compartidos main↔preload↔renderer (única fuente de verdad)
│   ├── schemas.ts     ← zod: Variant, SalesPoint, ForecastPoint, Recommendation,
│   │                    DataMetadata, Filters, Pagination, ApiError + respuesta uniforme
│   └── contracts.ts   ← AnalyticsApi (7 métodos del plan) + sobre { ok, data|error }
├── main/
│   ├── index.ts        ← ventana 1440×900 / min 1100×720, título propio, sandbox:true
│   ├── config/settings.ts     ← MAIN_VITE_DATA_MODE (default demo-local); modos no
│   │                             implementados rechazados de forma EXPLÍCITA
│   ├── ipc/bridge.ts          ← canales fijos analytics:*, validación de emisor
│   │                             (sender === webContents) + validación zod de params
│   └── services/
│       ├── provider.ts        ← interfaz común de datos (DataProvider)
│       └── demo-local.ts      ← proveedor demo-local; lee fixtures/demo-v1.json,
│                                 ruta resuelta; fixture ausente = dataset vacío
│                                 declarado en metadatos (nunca datos inventados)
└── preload/
    ├── index.ts       ← expone SOLO window.analyticsApi (los 7 métodos); sin
    │                    ipcRenderer completo ni ejecutor genérico
    └── index.d.ts     ← declaración global tipada
```

**Decisiones de diseño tomadas (para CONSULTA en pasos siguientes):**

1. **Sobre de respuesta discriminado { ok: true, data|error }**: los errores asíncronos de
   `ipcMain.handle` pierden su `apiCode` al cruzar el canal (Electron serializa throw como
   Error genérico). Con el sobre, los códigos estables de la sección 9.4 del plan
   (`NOT_FOUND`, `VALIDATION_ERROR`, `SERVICE_UNAVAILABLE`, `IPC_REJECTED`) llegan intactos
   al renderer. El renderer decide UI según `ok`.
2. **Rechazo explícito de modos no implementados**: si `MAIN_VITE_DATA_MODE` ≠ `demo-local`
   en A/B, el main aborta el arranque con error claro — nunca fallback silencioso (plan 4.1).
3. **Alias `@shared`** añadido al renderer (config + tsconfig) para importar los contratos
   sin duplicar tipos; main usa rutas relativas.
4. **Sandbox del renderer** corregido: el template traía `sandbox:false`; ahora `sandbox:true`
   con `contextIsolation` por defecto (true), según la guía de seguridad de Electron.
5. **`.env.example`** del escritorio creado con `MAIN_VITE_DATA_MODE` y
   `MAIN_VITE_ANALYTICS_API_URL` (sección 11 del plan; sin secretos).
6. **package.json** renombrado: `zapatillas-duoc-analytics`, versión 0.1.0; lock sincronizado vía Windows.

**Verificaciones reales del paso:**

- `npm run typecheck` ✅ sin errores (main y renderer).
- `npm run lint` ✅ sin errores tras añadir la convención `*_` (args/vars marcados con
  prefijo subrayado se ignoran: no-unused-vars).
- `npm run dev` ✅: 4 procesos electron estables, builds limpios, y cierre ordenado
  con exit 0 (sin el error crashpad del incidente del Paso 2).
- Prueba punta a punta implementada en `App.tsx` temporal: llama `getDataStatus()` por el
  puente y renderiza los 3 estados (carga/éxito/error). Dataset vacío honesto:
  "Modo: demo-local · Fixture cargado: pendiente (Paso 5)" + limitación explícita.
  El App.tsx temporal se sustituye en el Paso 4.

**Pendiente:** confirmación visual del usuario de la tarjeta de estado del puente
(la ventana corrió y cerró limpiamente; el registro del log validó el flujo igualmente).

---

## Paso 4 — Adaptación del diseño de One-Templete (COMPLETADO ✅)

**Fecha:** 2026-10-17. **Confirmación visual del usuario:** "el diseño está perfecto, me encantó".

### Referencia visual (solo lectura)

- Se contrastó `procesos_automaticos/app/assets/css/main.css` contra la sección 7.1 del
  plan: los valores coinciden (paleta rojo "Flesan" #FF0000 con ramp completo, neutrales,
  superficies claras #F5F5F5/#FFFFFF/#E5E7EB, modo oscuro #0D0D12 con elevada #202028,
  severidades). No se clonó nada: se reimplementó como tokens propios (plan 2.3).
- La referencia carga Inter como subsets (`Inter-Latin.woff2`); el proyecto descargó la
  **variable font oficial** desde rsms.me/inter + su licencia OFL (plan: distribución
  oficial con licencia). Archivos en `src/renderer/src/assets/fonts/` (344 KB).

### Archivos creados

```
src/renderer/src/
├── styles/
│   ├── tokens.css          ← identidad: superficies por modo, acento, estados de riesgo, sombras
│   │                          + mapa @theme inline para utilidades Tailwind v4
│   └── globals.css         ← @font-face Inter (100–900 variable), --radius 0.75rem (tarjetas
│                              radio 12px), prefers-reduced-motion respetado
├── assets/fonts/
│   ├── InterVariable.woff2 ← distribución oficial rsms.me/inter
│   └── Inter-License.txt   ← licencia OFL
├── app/
│   ├── themeContext.ts     ← contexto compartido (separado por react-refresh)
│   ├── useTheme.ts         ← hook useTheme()
│   └── ThemeProvider.tsx   ← claro por defecto; persistencia `retail-analytics-theme`
├── components/layout/
│   ├── AppShell.tsx        ← cabecera 64px fija + sidebar plegable + contenido con scroll
│   │                          único y margen 24px; posee el estado plegado
│   │                          (persistencia `retail-analytics-sidebar`)
│   ├── AppHeader.tsx       ← bg rgba(13,13,18,0.90) permanente, marca textual + punto rojo,
│   │                          centro de contexto, toggle tema, "Usuario demo" (sin auth)
│   ├── AppSidebar.tsx      ← bg rgba(18,18,24,0.95), 240px/64px, 6 entradas deshabilitadas
│   │                          (Paso 5 las conecta via HashRouter), acento rojo en activa
│   ├── SidebarItem.tsx     ← aria-current, tooltip al plegar (Radix Tooltip)
│   ├── sidebarEntries.ts   ← lista única de navegación = contrato de rutas del Paso 5
│   └── PageHeader.tsx      ← borde izquierdo rojo 5px, título 24px, descripción, acciones
└── components/shared/
    ├── SectionCard.tsx     ← tarjeta radio 12px, sombra discreta, título/desc/acciones
    ├── KpiCard.tsx         ← valor undefined/null → "—" (prohíbe inventar datos)
    ├── StatusBadge.tsx     ← siempre texto + icono (accesibilidad): stockout/excess/
    │                          balanced/insufficient_data con tokens por modo
    ├── statusMeta.ts       ← metadatos de estado (separado por react-refresh)
    ├── EmptyState.tsx      ← estado vacío distinguishable (plan sección 8)
    ├── ErrorState.tsx      ← muestra código stable del contrato + Reintentar
    ├── LoadingState.tsx    ← skeleton con forma del contenido
    ├── FilterBar.tsx       ← contenedor de filtros + botón Limpiar
    └── VariantDetailSheet.tsx ← hoja lateral con slots tipados (contenido real en Paso 5)
```

- `main.tsx` ahora envuelve `<ThemeProvider>`. `App.tsx` es la **página de verificación
  del layout** (KPIs en "—", paneles "pendiente del Paso 5", hoja lateral de prueba con
  riesgo `insufficient_data` — honesto: no hay datos aún).

### Decisión estructural: separación por react-refresh

`eslint-plugin-react-refresh` (only-export-components) exige 1 componente por módulo.
Constantes (`SIDEBAR_ENTRIES`, `STATUS_META`) y hooks (`useTheme`) viven en archivos
propios; los componentes solo exportan componentes. Se respeta en los pasos siguientes.

### Verificaciones reales del paso

- `npm run format` ✅ · `npm run typecheck` ✅ (0 errores) · `npm run lint` ✅ (0 errores).
- `npm run dev` ✅: 4 procesos electron, builds renderer/main/preload limpios, 0 errores
  en log. Instancia cerrada ordenadamente tras la confirmación del usuario.
- Checklist visual confirmado por el usuario: cabecera, sidebar plegable con tooltips,
  persistencia, PageHeader con borde rojo, claro/oscuro, foco visible, KPIs en "—"
  (sin datos inventados).

### Pendientes restantes

- [x] Paso 4: AppShell + tokens del plan (COMPLETADO, ver arriba).
- [x] Paso 5: fixture `demo-v1.json` y las 6 pantallas (COMPLETADO, Entrega A — ver arriba).
- [x] Paso 6: backend FastAPI con `.venv` y lock (COMPLETADO — ver abajo).
- [ ] Paso 7: proveedor `demo-api` en Electron (Entrega B, conexión real desktop↔API).

---

## Paso 5 — Fixture de demostración y 6 pantallas (COMPLETADO ✅, Entrega A)

**Fecha:** 2026-10-17. **Estado:** las 6 pantallas navegan con datos de
demostración; verificación runtime automatizada (0 errores de consola) +
16 capturas en `docs/screenshots/`. Confirmación visual del usuario: pendiente
en este registro (la ventana quedó abierta en modo normal).

### 5.1 — Fixture canónico + contratos + proveedor

- `fixtures/generate-demo-v1.mjs`: generador determinista (mulberry32,
  semilla `20260928`, corte `as_of = 2026-09-28`, CLP, es-CL). Produce:
  4 modelos × 2 colores × 5 tallas EU = **40 variantes**, 480 puntos de venta
  (12 semanas), 160 puntos de pronóstico (4 semanas, `method: "fixture"`,
  `model_version: null`), 40 recomendaciones. Cobertura de casos:
  `replenish` 3 · `maintain` 16 · `defer_purchase` 11 (2 con demanda cero) ·
  `review_data` 10 (el modelo Insignia queda "indisponible" desde la semana 5).
- Válidación automática del dataset en `fixtureStore.test.ts` (vitest):
  **10/10 pruebas pasando**; `vitest.config.ts` añadido; `package.json` con
  `"test": "vitest run"` (y `test:run` alias).
- Contratos extendidos en `shared/schemas.ts` / `shared/contracts.ts`:
  `variant_id` requerido para `getForecasts`/`getRecommendations` por variante;
  `variantRowSchema` para el listado; filtros con `variant_id`;
  recomendaciones con `parameters` (umbrales reales de la regla, sin magia).
- `ProviderValidationError` en `provider.ts`, mapeada en `bridge.ts` a
  `VALIDATION_ERROR` / `NOT_FOUND` — errores explícitos, sin fallbacks.
- `fixtureStore.ts`: carga pura (sin imports de electron) del JSON con cache.
- Versión de app inyectada: `define` en `electron.vite.config.ts` expone
  `APP_VERSION` (leída de package.json) al renderer; tipos en `env.d.ts`.

### 5.2 — Las 6 pantallas

Rutas (HashRouter): `/overview` · `/variants` · `/forecasts` ·
`/recommendations` · `/data-status` · `/settings`. Arquitectura: un solo
`AppShell` a nivel de router (`RoutedApp` en `App.tsx`); las páginas
(`features/*.tsx`) solo devuelven contenido; providers en `main.tsx`
(QueryClientProvider); hooks en `hooks/api.ts`; helper `callOk` +
`ApiCallError` en `services/analytics.ts`. Todos los datos visibles llevan
el chip **"Datos de demostración"**.

### Bug crítico resuelto en este paso (causa raíz documentada)

- **Síntoma:** la ventana se veía totalmente en blanco al abrir la app del Paso 5.
- **Diagnóstico:** relanzamiento con `ELECTRON_ENABLE_LOGGING=1` capturó
  `Uncaught Error: 'Tooltip' must be used within 'TooltipProvider'` (Radix):
  el tooltip del sidebar (creado en el Paso 4, solo se activaba al plegar)
  montaba sin provider al renderizar la app navegable del Paso 5.
- **Corrección:** `TooltipProvider` global en `AppShell.tsx` (patrón Radix
  correcto, cubre tooltips presentes y futuros). Sin cambios de diseño.

### Verificación runtime automatizada (CDP)

- Dev relanzado con `REMOTE_DEBUGGING_PORT` (soportado nativamente por
  electron-vite) y sondeo CDP (Chrome DevTools Protocol) contra la ventana:
  las 6 rutas renderizan contenido real (tablas: 1 en Variantes, 1 en
  Recomendaciones con 40 filas; gráficos recharts: 1 en Resumen, 1 en
  Pronósticos) con **0 errores de consola**.
- Herramientas: scripts Node efímeros en la carpeta temporal del usuario
  (no forman parte del proyecto); moderna lección: también sirve
  `Page.captureScreenshot` para evidencia.

### Capturas de pantalla (punto 7 del plan)

- 16 PNG en `docs/screenshots/`: 6 rutas × tema claro/oscuro a **1440×900** +
  Resumen y Variantes a **1366×768** (ambos temas). Toma por CDP con
  override de métricas + captura directa de ventana (`fromSurface: false`),
  verificadas: nombres correctos por ruta/tema y contraste oscuro/claro
  medido (luminancia media oscura ≈ 27–31 vs claro ≈ 221–231).
- Nota de herramienta: `Emulation.setDeviceMetricsOverride` congela el frame
  de superficie en Electron headful si se captura por `fromSurface` por
  defecto; la combinación funcional quedó documentada en el flujo de toma.

### Ajuste de pulido posterior (también en el Paso 5)

- **Doble scrollbar resuelto.** Síntoma reportado por el usuario: junto al
  scroll interno con diseño (el del `<main>`) aparecía un scroll exterior
  (el del documento, de 64 px). Causa raíz: el wrapper de `AppShell` era
  `min-h-screen` y el `mt-16` del `<main>` colapsaba hacia fuera del
  contenedor (*margin collapse*), sumando 64 px al documento (745 px reales
  en un viewport de 681 px). Corrección: wrapper `h-screen overflow-hidden`
  (bloque formateador que contiene el margen). Verificado por DOM (CDP):
  `documentElement.scrollHeight == clientHeight` (1350×681 → sin overflow
  del documento) y apenas el scroll interno del área de contenido resta.

### Checklist Entrega A (sección 14 del plan)

- [x] Ventana navegable con las 6 pantallas y datos de demostración.
- [x] Todo dato rotulado "Datos de demostración"; nada inventado.
- [x] Fixture único canónico `fixtures/demo-v1.json` generado por script.
- [x] `typecheck` ✅ · `lint` ✅ · `test` 10/10 ✅ · `dev` sin errores de consola.
- [x] Capturas de ambas resoluciones y ambos temas.
- [x] Confirmación de pulido: scrollbar único interno (ver "Ajuste de pulido").
- [x] Confirmación visual final del usuario: al validar el arreglo del scroll
      continuó a la siguiente fase ("continuemos con la siguiente fase"), con
      la ventana abierta en modo normal mostrando el scrollbar único interno.

---

## Etapa C — Conexión real a Supabase, solo lectura (EN CURSO 🔧)

**Fecha:** 2026-10-18. Ejecuta el plan acordado C0–C4: la app lee datos
reales vía **Electron → FastAPI → Supabase REST** con la clave pública y
RLS intacta. **Sin ML, sin inserts, sin migraciones, sin service_role.**

### C0 — Diagnóstico (COMPLETADO ✅)

- Esquema confirmado desde el CSV de Supabase (14 tablas, FKs verificadas).
- Regla de negocio: **venta confirmada = `pedidos.estado = 'exitoso'`**
  (webhook MercadoPago: exitoso/pendiente/erroneo); montos =
  cantidad × precio_unitario (CLP); `stock` por producto × talla.
- Faltantes declarados (no inventados): sin unidades en tránsito, sin
  dimensión de talla, sin sistema de talla, sin costos/lead times.
- Consultas mínimas sin datos personales; agregaciones en Python
  (PostgREST no tiene GROUP BY agregable y no se crean vistas/funciones).

### C1 — Configuración y consultas documentadas (COMPLETADO ✅)

- `docs/CONSULTAS_SUPABASE.md`: cada SELECT con propósito, joins, columnas,
  reglas y el aviso SQL Editor (rol postgres) ≠ accesos reales de la app
  (rol anon + RLS). Incluye cómo validar con `SET LOCAL ROLE anon`.
- `services/analytics-api/.env` y `apps/desktop/.env` creados con
  placeholders (los rellena el usuario; el servicio nunca imprime valores).

### C2 — Proveedor connected + puente HTTP (COMPLETADO ✅, conexión real PENDIENTE de credenciales del usuario)

- **FastAPI**: `SupabaseRestRepository` (httpx → PostgREST, paginación por
  `Content-Range`, TTL 60 s) + `AnalyticsServiceConnected` con el MISMO
  contrato `data-status: {data_source: supabase, forecast_method: null}`,
  Reglas: todo se deriva de `pedidos/stock/productos`; sin recomendaciones
  ni pronósticos (listas vacías honestas, rótulo "Modelo predictivo
  pendiente"). `horizon_weeks` → 422 VALIDATION_ERROR en connected.
- Errores nuevos: `SERVICE_UNAVAILABLE` (503, red/HTTP 5xx) y
  `PERMISSION_DENIED` (403, RLS bloquea al rol anon — nunca se bypasea).
- `httpx` pasó a dependencia principal; lock regenerado con pip-tools.
- **Electron**: `ApiHttpProvider` (main) → `http://127.0.0.1:8000`
  (`MAIN_VITE_ANALYTICS_API_URL`), timeouts 20 s, mapeo de errores;
  `main/index.ts` ya conmuta `demo-api`/`connected` — **nunca** fallback
  silencioso a demo-local.
- Contratos: `forecast_method` nullable (zod + pydantic) y código
  `PERMISSION_DENIED` agregado al sobre; `meta.mode` por APP_MODE real.

### C3 — Pantallas (COMPLETADO ✅ para render, verificación real pendiente de conexión)

- `DemoChip` consciente del modo: «Datos de demostración» ↔ «Datos en
  vivo · solo lectura» (verde) según `metadata.data_mode`.
- Banner compartido `ModelPendingNote` en Pronósticos, Recomendaciones y
  paneles de riesgo del Resumen (solo en connected).
- Pronósticos: historial real + proyección vacía (no se disfraza de
  predicción); Recomendaciones: vacío + estado "Requiere modelo".

### Verificaciones ejecutadas (2026-10-18)

| Verificación | Resultado |
|---|---|
| `ruff check app tests` (FastAPI) | 0 errores |
| `pytest tests -q` | **28/28** (16 demo + 12 connected con Supabase simulado: httpx.MockTransport) |
| `typecheck` (main+web) | ✅ |
| `lint` (Electron) | ✅ 0 problemas |
| `vitest` | 10/10 |
| Cadena demo-api por CDP | React→IPC→ApiHttpProvider→FastAPI: overview con números idénticos al demo-local (2 240 uds · $177 272 600 · 40 variantes) |
| Regla anti-silencio por CDP | API apagada → `{ok:false, code:SERVICE_UNAVAILABLE}` visible, sin fallback a demo |

### Pendiente (bloqueado por configuración, no por código)

1. Usuario completa en `services/analytics-api/.env`:
   `APP_MODE=connected`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`.
2. Smoke real de lectura: `/health`, conteos y rango de fechas — sin
   exponer datos personales.
3. Capturas en modo connected + verificación visual del usuario.
4. Si RLS no permite SELECT al anon: documentar bloqueo y decidir
   políticas con el equipo (NO se modifican desde aquí).

---

## Paso 6 — Backend FastAPI demo (COMPLETADO ✅, Entrega B parte 1)

**Fecha:** 2026-10-17/18. **Estado:** `services/analytics-api/` operativo:
ruff 0 errores · **pytest 16/16** · servidor verificado en vivo
(`/health`, `/docs`, endpoints `/api/v1/*`) con los **mismos números del
fixture** que el proveedor demo-local (2240 uds · 177 272 600 CLP · 40
variantes · 3/16/11/10 recomendaciones).

### Estructura creada (sección 6 del plan)

```text
services/analytics-api/
├── pyproject.toml            ← deps Entrega B + extra dev; sin ML ni Supabase
├── requirements.lock.txt     ← pip-tools (34 paquetes resueltos)
├── .env.example              ← APP_ENV/APP_MODE=demo/DEMO_DATASET_PATH
├── .gitignore                ← .venv/, .env, caches, logs
├── app/
│   ├── main.py               ← create_app(): routers + handlers de error uniformes
│   ├── core/config.py        ← pydantic-settings; ruta del fixture resuelta
│   │                            desde services/analytics-api (no cwd); modos
│   │                            no implementados abortan con mensaje claro
│   ├── schemas/domain.py     ← espejo pydantic de shared/schemas.ts (mismos
│   │                            campos y nullables, para paridad de contrato)
│   ├── repositories/fixture_repository.py  ← carga y validación del fixture +
│   │                                          índices por variante; error
│   │                                          explícito si falta o es incoherente
│   ├── services/analytics_service.py  ← la lógica del proveedor demo-local
│   │                                   portada a Python (filtrado, KPIs,
│   │                                   orden compat Intl.Collator es-CL)
│   ├── services/exceptions.py        ← NotFoundVariantError/BusinessValidationError
│   └── api/v1/router.py    ← /health + /api/v1/{data-status, filters, overview,
│                              variants, variants/{id}, forecasts, recommendations}
└── tests/                    ← conftest (cliente) + 16 pruebas con números
                                 amarrados al dataset canónico
```

### Versiones realmente resueltas (del lock)

fastapi 0.144.0 · pydantic 2.14.1 · pydantic-settings 2.16.0 ·
uvicorn[standard] 0.54.0 · pytest 9.1.1 · httpx 0.28.1 · ruff 0.17.1 ·
pip-tools 7.6.2. Python: el `py -3.12` ya documentado (3.12.4).

### Decisiones y detalles de implementación

1. **Sobre de respuesta `{data, meta, pagination?}`** (plan 9.4) y errores
   como `{error: {code, message}}`: `404 NOT_FOUND` (variante desconocida),
   `422 VALIDATION_ERROR` (horizonte > fixture, fecha mal formada,
   riesgo inexistente), con handlers globales de FastAPI.
2. **Paridad demo-local ↔ demo-api por diseño:** las agregaciones se
   portaron del `DemoLocalProvider`; la prueba de composición
   (3/16/11/10) y los KPIs quedan amarrados a números del dataset —
   así el Paso 7 puede conmutar el modo sin sorpresas.
3. **Orden compatible `Intl.Collator('es',{numeric:true})`:** clave de
   colación propia (quita acentos + ordena numéricamente segmentos), para
   identificar equivalencias de listados entre ambos proveedores.
4. **Sin CORS y sin endpoints de entrenamiento:** el consumidor es el
   proceso main de Electron (fetch, no navegador); no se expone nada que
   simule entrenamiento ni conexión real; el modo `connected` queda
   documentado como etapa posterior.
5. **Aviso de deprecación de Starlette:** el TestClient muestra un aviso
   sobre `httpx` (recomienda `httpx2`); es de las bibliotecas, no del
   código del proyecto, y no afecta los resultados de la Entrega B.

### Verificación en vivo del servidor (PowerShell, lado Windows)

- `/health → {ok: true, mode: demo-api, dataset_available: true,
  dataset_version: demo-v1.0.0, dataset_as_of: 2026-09-28}`.
- `/api/v1/overview → units=2240 clp=177272600 total=40` (idéntico al
  demo-local del escritorio).
- `/api/v1/variants?page_size=5 → total=40`, primera fila ordenada con
  `risk`/`action` derivados del fixture.
- `/api/v1/variants/variante-fantasma → 404 {NOT_FOUND}` y
  `/api/v1/variants?horizon_weeks=9 → 422 {VALIDATION_ERROR}` con mensaje.
- `/docs → 200` (Swagger UI).
- Servidor arranca de solo loopback `127.0.0.1:8000` (plan, Paso 6 punto 6)
  y se apagó de forma limpia tras la verificación.

### Cómo arrancarla (documentado, igual al plan)

```powershell
cd services/analytics-api
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Checklist Entrega B (estado al cierre del Paso 6)

- [x] La API inicia con configuración demo, ofrece `/health`, `/docs` y los
      endpoints del plan 9.4.
- [ ] La UI usa el proveedor HTTP manteniendo pantallas/contratos de A (Paso 7).
- [x] Resultados equivalentes demo-local ↔ demo-api (KPIs y composición amarrados
      por pruebas; verificación punto a punto del overview).
- [ ] Al apagar la API aparece un error claro sin cambiar silenciosamente de
      modo (Paso 7).
- [x] Ninguna ruta afirma modelo entrenado, conexión real o autenticación.
