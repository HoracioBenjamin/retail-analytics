# Guía de diseño — Zapatillas Duoc Analytics

> Fuente de verdad visual de la app de escritorio. Adaptación del diseño de
> "One-Templete" (referencia `procesos_automaticos`, **solo lectura**) según la
> sección 7 del plan. No clonar archivos de la referencia: los tokens se
> reimplementaron en `apps/desktop/src/renderer/src/styles/tokens.css`.

## 1. Identidad

| Elemento | Valor |
|---|---|
| Tipografía | **Inter** (variable 100–900, local en `src/assets/fonts/InterVariable.woff2`, licencia OFL en `Inter-License.txt`) |
| Acento | Rojo `#FF0000` (modo oscuro usa `#FF4433` para contraste) |
| Acento fuerte (texto pequeño) | `#BD0003` claro / `#FF7160` oscuro |
| Superficie de app | `#F5F5F5` claro / `#0D0D12` oscuro |
| Tarjetas | `#FFFFFF` / `#202028`, radio **12 px** (`--radius: 0.75rem`) |
| Borde | `#E5E7EB` claro / `rgba(255,255,255,0.08)` oscuro |
| Cabecera | 64 px, `rgba(13,13,18,0.97)` + blur; marca propia, selector de módulo y menú del espacio de trabajo |
| Sidebar | 240 px desplegado / **64 px plegado**, `#121218` (oscuro en ambos temas); control de plegado superior |
| Actividad en sidebar | borde rojo izquierdo + fondo rojo suave + texto/icono coral |
| Sombras | `--shadow-card` 0 1px 3px rgba(0,0,0,.08) · `--shadow-card-lg` 0 4px 12px rgba(0,0,0,.1) |
| Padding de página | 24 px horizontales, independientes del ancho del sidebar; breadcrumb superior y scroll principal único |

## 2. Estados de riesgo (siempre texto + icono)

Nunca comunicar estado solo con color (accesibilidad). Contenedor: `StatusBadge`.

| Riesgo | Claro | Oscuro | Icono | Texto por defecto |
|---|---|---|---|---|
| `stockout` | `#DC2626` | `#F87171` | TriangleAlert | "Riesgo de faltante" |
| `excess` | `#D97706` | `#FBBF24` | ArrowDownRight | "Exceso / baja rotación" |
| `balanced` | `#16A34A` | `#4ade80` | CheckCircle2 | "Equilibrado" |
| `insufficient_data` | `#6B7280` | `#9CA3AF` | CircleAlert | "Datos insuficientes" |

Fondos: el mismo color al 10 % (`bg-status-*/10`).

## 3. Uso de utilidades

Los tokens se exponen como utilidades Tailwind v4 vía `@theme inline`:

- Acento: `text-brand`, `bg-brand`, `bg-brand/10`, `text-brand-strong`, `bg-brand-soft`.
- Navegación: `bg-surface-header`, `bg-surface-sidebar`, `text-surface-sidebar-text`,
  `text-surface-sidebar-text-active`, `hover:bg-surface-sidebar-hover`.
- Estados: `text-status-stockout`, `bg-status-balanced/10`, etc.
- Sombras: `shadow-[var(--shadow-card)]`.

Las variantes semánticas de shadcn (`bg-background`, `bg-card`, `border`, `text-foreground`,
`text-muted-foreground`…) están **remapeadas a los valores de identidad** en `tokens.css`;
los componentes de `src/renderer/src/components/ui/**` funcionan sin cambios.

## 4. Tema y preferencias

- `ThemeProvider` aplica la clase `dark` a `<html>` y `color-scheme`.
- Claves de persistencia propias del plan: `retail-analytics-theme` (`light|dark`) y
  `retail-analytics-sidebar` (`collapsed|expanded`). Tema claro por defecto.
- `prefers-reduced-motion: reduce` anula transiciones/animaciones (CSS global).
- Sin librerías de animación externas.

## 5. Reglas de accesoibilidad y honestidad de datos

1. **Foco visible**: anillo con el acento (`--ring`) ya aplicado por shadcn.
2. **Contraste**: en modo oscuro el acento de texto pequeño usa el tinte claro; nunca
   `#FF0000` puro para texto pequeño sobre fondo oscuro.
3. **Sin números inventados**: si no hay dato, el componente muestra `—`
   (`KpiCard`) o `EmptyState` con mensaje accionable. Los "pendientes del Paso 5"
   se retirarán cuando exista el fixture.
4. **Estados distinguishables** (plan sección 8): carga (skeleton) ≠ vacío ≠ error ≠ éxito;
   el error muestra el código estable del contrato y ofrece Reintentar.
5. **Gráficas**: contenedor con tamaño definido, colores temáticos, leyenda que separa
   explícitamente el histórico del pronóstico ilustrativo.

## 6. Estructura de pantalla tipo (AppShell)

```text
┌─ AppHeader (64 px, fijo, oscuro) ─ marca · selector de módulo · tema · espacio de trabajo ─┐
├─ AppSidebar (izq, oscuro) ──┬─ contenido (margen 24 px, scroll único) ─────────────┤
│ Resumen                     │  PageHeader (borde rojo izq., título 20 px, acciones) │
│ Variantes e inventario      │  FilterBar                                            │
│ Pronósticos                 │  KpiCards (grid 4)                                    │
│ Recomendaciones             │  SectionCards (paneles, gráficas, tablas)             │
│ Estado de datos / Ajustes   │  VariantDetailSheet en hoja lateral derecha           │
└─ Contexto ──────────────────┴───────────────────────────────────────────────────────┘
```

## 7. Ajuste de fidelidad a ONE — 20/10/2026

Se contrastaron los componentes locales de `procesos_automaticos`: `HeaderBar`,
`MenuHeader`, `UserCard`, `NavBar`, `HeaderPage` y los paneles del dashboard. La
adaptación conserva la identidad Zapatillas Duoc y los servicios actuales; no
incorpora autenticación, logotipos ni dependencias corporativas.

- Cabecera con marca textual **DUOC analytics**, selector funcional de pantallas
  y bloque de espacio de trabajo. El bloque muestra el modo de datos conocido,
  sin atribuir una identidad o sesión de usuario que no existe.
- Menús oscuros con navegación, cambio de tema, estado de datos y preferencias.
- Sidebar con grupos **Análisis comercial** y **Espacio de trabajo**, botón de
  plegado superior, estado activo rojo suave y tarjeta de contexto inferior.
- Breadcrumb y fecha de corte bajo la cabecera. El origen de datos conserva su
  rótulo, tanto en modo demo como conectado.
- `PageHeader` ahora es una superficie con borde, radio de 10 px, acento rojo y
  título de 20 px, siguiendo la composición de la referencia.
- `SectionCard` usa encabezado compacto con separador y control accesible para
  plegar/desplegar el contenido. Se quitaron el padding vertical y gap extra del
  Card genérico que duplicaban el espacio interior.
- KPIs con iconos en recuadros suaves y valores en una fila propia para evitar
  que los importes largos se superpongan al icono.
- El ancho del sidebar se comparte mediante `--sidebar-width`; el contenido
  comienza después de ese ancho y conserva su padding horizontal de 24 px.
- Los estilos de composición se concentran en `styles/one-layout.css`; los
  colores semánticos siguen en `tokens.css`.

Las capturas de esta revisión se guardan en `docs/screenshots/one-refresh/`.
La verificación visual usa una instancia aislada de Electron con fixture
`demo-local`, sin consultar Supabase ni modificar preferencias de la sesión
habitual. No equivale a validar datos reales ni a probar un instalador.
