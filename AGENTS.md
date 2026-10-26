# AGENTS.md — Zapatillas Duoc Analytics

Guía de arranque para cualquier IA o persona que trabaje en este proyecto. **Léela completa antes de escribir código.**

- Versión: 1.0 · Fecha: 17 de octubre de 2026 · Estado: fase de construcción de la **base** (Entregas A y B en curso).

## 1. Qué es este proyecto

Aplicación de escritorio (Windows) para analizar ventas e inventario de zapatillas por **variante = modelo + color + talla**, con dos objetivos comerciales: **reducir sobrestock** (menos liquidaciones) y **prevenir agotamientos** de variantes demandadas. La primera meta es una **base visual navegable con datos de demostración**, y luego su conexión a una **API demo**. El motor predictivo real (ML, Supabase, autenticación) llega después.

**Stack del proyecto:** Electron + React + TypeScript, Python + FastAPI (Entrega B), Tailwind CSS 4 + shadcn/ui como sistema de UI.

- Nombre de trabajo: **Zapatillas Duoc Analytics**.
- Es un proyecto **académico** (Duoc UC) y el tercero de un grupo de softwares: tienda Next.js + dashboard Ionic (referencias externas, no tocar) + este aplicativo (producto principal).

## 2. Documentos de referencia (leer primero)

Ubicados una carpeta arriba (`..`), en `C:\Users\practica.pti\Documents\0.Duoc Uc\`:

| Documento | Para qué |
|---|---|
| `PLAN_BASE_SOFTWARE_PREDICTIVO.md` | **El plan maestro.** Síguelo paso a paso desde su sección 10 ("Pasos de ejecución"). No improvises etapas. |
| `RESUMEN_GENERAL_PROYECTO.md` | Visión completa del proyecto, arquitectura y estrategia de datos/ML. |
| `docs/DEPENDENCIAS.md` | Registro real de entorno, versiones resueltas y estado por paso. **Actualízalo al completar cada paso.** |
| Referencia visual (solo lectura): `C:\Users\practica.pti\Documents\procesos_automaticos` | De ahí se **adapta el diseño** (cabecera oscura, sidebar plegable, acento rojo `#FF0000`, Inter). NO reutilices su backend, autenticación ONE ni lógica de procesos. |

## 3. Reglas de oro (prohibiciones del plan)

1. **NO modificar** la tienda Next.js, el dashboard Ionic, `procesos_automaticos` ni Supabase. Solo lectura.
2. **NO implementar todavía:** autenticación real, migraciones de BD, motor ML, compras automáticas, integración multiempresa, instalador con firma. Esas son etapas posteriores documentadas en el plan.
3. **NO fingir capacidades:** todo dato rotulado como "Datos de demostración"; nada de métricas de precisión inventadas ni conexiones que no existan. Si algo no está implementado: error explícito, nunca fallback silencioso.
4. **NO usar `--force`, `--legacy-peer-deps` ni desactivar TLS** (`NODE_TLS_REJECT_UNAUTHORIZED=0` prohibido).
5. NO cambiar de React a Vue, no añadir Express ni convertir la app en página Next.js.
6. NO crear repositorios Git anidados automáticamente; respeta la estrategia del equipo (la carpeta madre `0.Duoc Uc` ya es un repo).
7. NO pedir credenciales para la base demo: **no necesitas ninguna** (modos `demo-local`/`demo-api` funcionan sin Supabase ni Python).

## 4. Modo de datos y límites de cada entrega

| Modo | Fuente | Cuando existe |
|---|---|---|
| `demo-local` | Fixture local `fixtures/demo-v1.json` | Entrega A (funciona sin API ni credenciales) |
| `demo-api` | FastAPI local con el mismo fixture | Entrega B |
| `connected` | FastAPI + Supabase con sesión | **Etapa posterior — documentado como NO disponible** |

**El objetivo de la base A+B es:** app Electron navegable con las 6 pantallas (Resumen `/overview`, Variantes `/variants`, Pronósticos `/forecasts`, Recomendaciones `/recommendations`, Estado de datos `/data-status`, Ajustes `/settings`) + FastAPI demo con los endpoints `/health`, `/api/v1/*` del plan (sección 9.4). **Al terminar A y B, se presenta la base y se detiene la implementación ahí.**

## 5. Estructura y comandos

```text
retail-analytics-desktop/
├── AGENTS.md            ← estás aquí
├── docs/                ← registro vivo (DEPENDENCIAS.md, y luego ARQUITECTURA, DESIGN, CONTRATO_API…)
├── apps/desktop/        ← app Electron (electron-vite, preset react-ts)
│   └── src/{main,preload,renderer}/
├── services/analytics-api/   ← backend FastAPI (Entrega B, aún por crear)
└── fixtures/demo-v1.json     ← dataset canónico de demostración (única fuente de datos demo)
```

**Entorno Windows** (el de Electron; WSL es solo alterno para el backend):

```powershell
cd apps/desktop
npm run dev         # ejecutar y ver la ventana
npm run typecheck   # separa main (tsconfig.node) y renderer (tsconfig.web)
npm run lint
```

**Reglas de entorno:**
- Ejecutar Node/Electron **desde PowerShell/Windows**; nunca compartir `node_modules` ni `.venv` entre Windows y WSL (se regeneran con `npm ci` al cambiar de sistema).
- Los finales de línea están normalizados con `.gitattributes` (`eol=lf`); respetar `.gitignore`.

## 6. Flujo de trabajo recomendado

1. Leer este archivo + el plan (secciones 3–10) + `docs/DEPENDENCIAS.md`.
2. Identificar en qué paso quedó el trabajo (el registro del punto 6 de `docs/DEPENDENCIAS.md` lo dice).
3. Ejecutar **un paso a la vez**, en orden, verificando cada resultado antes de seguir.
4. Registrar lo hecho (versiones resueltas, fallos, decisiones) en `docs/DEPENDENCIAS.md`.
5. Si la app está en modo demo, **todo dato visible debe decir "Datos de demostración"**.
6. Antes de dar por terminada una entrega: revisar los checklists de aceptación del plan (sección 14) y devolver al usuario evidencia (capturas reales, salidas de comandos).
7. Ante un bloqueo de compatibilidad, documentar el caso y ajustar la herramienta concreta **sin romper los límites arquitectónicos** (sección 15 del plan: "decisiones cerradas").
