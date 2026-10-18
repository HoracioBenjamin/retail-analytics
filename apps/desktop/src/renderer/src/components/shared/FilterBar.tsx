import { Filter, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Barra de filtros compartida (plan, sección 8: Resumen). En el Paso 4
 * es contenedor estructural; los selects de período/modelo/color/talla
 * se enchufan en el Paso 5 con valores reales del fixture.
 */
export function FilterBar({
  children,
  onClear,
  clearDisabled,
  className
}: {
  children?: React.ReactNode
  onClear?: () => void
  clearDisabled?: boolean
  className?: string
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-xl border bg-card p-4 shadow-[var(--shadow-card)]',
        className
      )}
      role="group"
      aria-label="Filtros"
    >
      <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="size-3.5" aria-hidden="true" />
        Filtros
      </span>
      {children}
      <Button
        variant="ghost"
        size="sm"
        className="ml-auto gap-1.5 text-xs"
        onClick={onClear}
        disabled={clearDisabled}
      >
        <RotateCcw className="size-3.5" aria-hidden="true" />
        Limpiar
      </Button>
    </div>
  )
}
