import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * Campo de búsqueda compartido (patrón del plan, sección 8): se usa como
 * primer elemento de la FilterBar en las páginas con listas de variantes.
 * Solo presentación: el filtrado lo resuelve cada página sobre sus filas,
 * nunca dentro de este componente.
 */
export function SearchInput({
  value,
  onChange,
  placeholder,
  className,
  ariaLabel = 'Buscar'
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
  className?: string
  ariaLabel?: string
}): React.JSX.Element {
  return (
    <span className="relative">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn('h-9 pl-8 text-xs', className)}
      />
    </span>
  )
}
