import type { RiskLevel } from '@shared/schemas'
import { CircleAlert } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUS_META } from './statusMeta'

/**
 * Sello de estado por riesgo (plan 7.1): siempre texto + icono. El texto
 * puede sobrescribirse por la pantalla según su semántica de negocio.
 */
export function StatusBadge({
  risk,
  label,
  className
}: {
  risk: RiskLevel
  label?: string
  className?: string
}): React.JSX.Element {
  const meta = STATUS_META[risk] ?? {
    label: 'Estado desconocido',
    icon: CircleAlert,
    text: 'text-muted-foreground',
    bg: 'bg-muted'
  }
  const Icon = meta.icon
  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1.5 border-transparent text-xs font-medium',
        meta.text,
        meta.bg,
        className
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label ?? meta.label}
    </Badge>
  )
}
