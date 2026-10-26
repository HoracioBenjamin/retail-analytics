import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'

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
  const [expanded, setExpanded] = useState(true)
  const contentId = useId()
  return (
    <Card
      className={cn(
        'one-section-card gap-0 overflow-hidden py-0 shadow-[var(--shadow-card)]',
        className
      )}
    >
      {(title || actions) && (
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b px-5 py-4">
          <div className="flex min-w-0 items-start gap-2.5">
            {title && (
              <button
                type="button"
                className="one-section-toggle"
                onClick={() => setExpanded((value) => !value)}
                aria-label={`${expanded ? 'Plegar' : 'Desplegar'} ${title}`}
                aria-expanded={expanded}
                aria-controls={contentId}
              >
                <ChevronDown
                  className={cn('size-4 transition-transform', !expanded && '-rotate-90')}
                />
              </button>
            )}
            <div className="min-w-0 space-y-1.5">
              {title && <CardTitle className="text-sm leading-5">{title}</CardTitle>}
              {description && (
                <CardDescription className="text-xs leading-relaxed">{description}</CardDescription>
              )}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </CardHeader>
      )}
      <CardContent id={contentId} hidden={!expanded} className={cn('p-5', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
