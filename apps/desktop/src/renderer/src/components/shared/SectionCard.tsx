import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Contenedor de sección (plan 7.3): tarjeta radio 12 px, relleno 20 px,
 * sombra discreta y borde temático, con título/descripción y acciones.
 */
export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
  contentClassName
}: {
  title?: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}): React.JSX.Element {
  return (
    <Card className={cn('shadow-[var(--shadow-card)]', className)}>
      {(title || actions) && (
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div className="min-w-0 space-y-1">
            {title && <CardTitle className="text-base">{title}</CardTitle>}
            {description && <CardDescription className="text-xs">{description}</CardDescription>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent className={cn('p-5', contentClassName)}>{children}</CardContent>
    </Card>
  )
}
