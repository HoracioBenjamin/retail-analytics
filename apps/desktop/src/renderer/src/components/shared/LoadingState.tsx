import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * Estado de carga del plan (sección 8): skeleton con la forma del
 * contenido esperado, controlado por la pantalla que lo usa.
 */
export function LoadingState({
  rows = 3,
  className
}: {
  rows?: number
  className?: string
}): React.JSX.Element {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando"
      className={cn('flex flex-col gap-3 rounded-xl border bg-card p-5', className)}
    >
      <Skeleton className="h-4 w-40" />
      {[...Array(rows)].map((_, i) => (
        <Skeleton key={i} className="h-4 w-full" />
      ))}
    </div>
  )
}
