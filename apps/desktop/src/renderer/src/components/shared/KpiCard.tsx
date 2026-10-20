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
        'one-kpi-card flex flex-col rounded-xl border bg-card p-5 shadow-[var(--shadow-card)]',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium leading-5 text-muted-foreground">{label}</p>
        </div>
        {Icon && (
          <span className="one-kpi-icon">
            <Icon className="size-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="mt-3 text-[clamp(1.125rem,2vw,1.625rem)] leading-tight font-semibold tracking-tight text-foreground tabular-nums">
        {loading ? '…' : value === undefined || value === null ? '—' : String(value)}
      </div>
      {hint && (
        <div className="mt-4 border-t pt-3 text-[11px] leading-relaxed text-muted-foreground">
          {hint}
        </div>
      )}
    </div>
  )
}
