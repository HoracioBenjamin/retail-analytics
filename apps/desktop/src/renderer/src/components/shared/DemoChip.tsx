import { cn } from '@/lib/utils'

/**
 * Etiqueta obligatoria siempre que se muestran datos del modo demo
 * (sección 3 del AGENTS.md / reglas del plan): "todo dato visible debe
 * decir Datos de demostración". La cabecera y cada pantalla la referencian.
 */
export function DemoChip({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand-soft px-2.5 py-0.5 text-[11px] font-medium text-brand-strong dark:text-brand-strong',
        className
      )}
      title="Dataset de demostración determinista: sin modelo entrenado ni conexión a base de datos"
    >
      <span className="inline-block size-1.5 rounded-full bg-brand" aria-hidden="true" />
      Datos de demostración
    </span>
  )
}
