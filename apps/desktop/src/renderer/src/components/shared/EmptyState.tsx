import { Inbox, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Estado vacío obligatorio del plan (sección 8): distinguible de carga,
 * error y éxito. Mensaje accionable, sin número inventado.
 */
export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  className
}: {
  title: string
  description?: string
  icon?: LucideIcon
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/40 p-10 text-center',
        className
      )}
    >
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}
