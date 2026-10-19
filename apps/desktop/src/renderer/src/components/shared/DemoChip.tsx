import { cn } from '@/lib/utils'
import { useDatasetMetadata } from '@/hooks/api'

/**
 * Etiqueta obligatoria del modo de datos (reglas del plan + etapa C):
 * - demo-local / demo-api → "Datos de demostración" (dataset determinista).
 * - connected → "Datos en vivo · solo lectura" (Supabase vía FastAPI, clave
 *   pública, sin modelo: las pantallas de proyección muestran su propio
 *   rótulo de modelo pendiente).
 * El modo se lee de los metadatos de data-status (cache global de queries) —
 * nunca se adivina a partir de archivos de entorno del renderer.
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

/**
 * Banner plano para las pantallas que dependen del modelo predictivo aún
 * no construido (Pronósticos, Recomendaciones, panel de riesgo del Resumen).
 */
export function ModelPendingNote({ className }: { className?: string }): React.JSX.Element {
  const metadata = useDatasetMetadata()
  if (metadata?.data_mode !== 'connected') return <></>
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400',
        className
      )}
      role="status"
    >
      <span className="inline-block size-1.5 rounded-full bg-amber-500" aria-hidden="true" />
      Modelo predictivo pendiente: esta vista muestra historial/estado real; la proyección requiere
      el modelo de la etapa de su equipo.
    </div>
  )
}
