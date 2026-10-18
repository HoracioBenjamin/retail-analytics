import { cn } from '@/lib/utils'

/**
 * Encabezado de página (plan 7.1): borde izquierdo de acento de 5 px,
 * título 24 px, descripción y zona de acciones/filtros.
 */
export function PageHeader({
  title,
  description,
  actions,
  className
}: {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'border-l-5 border-l-brand pl-4',
        'flex flex-wrap items-start justify-between gap-4',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
