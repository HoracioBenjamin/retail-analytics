import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Tarjeta de indicador (plan 7.3): traducción de las MetricCard* de la
 * referencia. En Paso 4 solo se muestra con valor neutro "—" o null:
 * los reales llegan del fixture en el Paso 5 (no inventar datos).
 */
export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  loading = false,
  className
}: {
  label: string
  /** Valor presentable. Si no hay datos aún, el caller NO inventa: usa undefined. */
  value?: string | number
  hint?: string
  icon?: LucideIcon
  loading?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]',
        className
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {Icon && <Icon className="size-3.5" aria-hidden="true" />}
        {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight text-foreground">
        {loading ? '…' : value === undefined || value === null ? '—' : String(value)}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}
