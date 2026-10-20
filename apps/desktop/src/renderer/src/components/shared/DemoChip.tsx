import { cn } from '@/lib/utils'
import { useDatasetMetadata } from '@/hooks/api'

/**
 * Etiqueta obligatoria del modo de datos (reglas del plan + etapa C):
 * - demo-local / demo-api → "Datos de demostración" (dataset determinista).
 * - connected → "Datos en vivo · solo lectura" (Supabase vía FastAPI, clave
 *   pública; sin modelo entrenado aún).
 * El modo se lee de los metadatos de data-status (cache global de queries) —
 * nunca se adivina a partir de archivos de entorno del renderer.
 *
 * Nota: el banner "Modelo predictivo pendiente" se retiró de la UI a pedido
 * del usuario (2026-10-20). El mensaje sigue vivo en la API (forecast_method
 * null y limitations) y en docs/DEPENDENCIAS.md para retomarlo luego.
 */
export function DemoChip({ className }: { className?: string }): React.JSX.Element {
  const metadata = useDatasetMetadata()
  const connected = metadata?.data_mode === 'connected'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium',
        connected
          ? 'border-emerald-600/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border-brand/40 bg-brand-soft text-brand-strong dark:text-brand-strong',
        className
      )}
      title={
        connected
          ? 'Datos en vivo de Supabase, solo lectura (RLS). Sin modelo predictivo entrenado.'
          : 'Dataset de demostración determinista: sin modelo entrenado ni conexión a base de datos'
      }
    >
      <span
        className={cn(
          'inline-block size-1.5 rounded-full',
          connected ? 'bg-emerald-600' : 'bg-brand'
        )}
        aria-hidden="true"
      />
      {connected ? 'Datos en vivo · solo lectura' : 'Datos de demostración'}
    </span>
  )
}
