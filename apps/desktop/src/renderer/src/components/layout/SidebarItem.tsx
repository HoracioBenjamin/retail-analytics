import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export interface SidebarEntry {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Ruta futura (Paso 5 usa HashRouter); presente desde ahora como contrato. */
  path: string
}

interface SidebarItemProps {
  entry: SidebarEntry
  active: boolean
  collapsed: boolean
  onSelect?: (entry: SidebarEntry) => void
}

export function SidebarItem({
  entry,
  active,
  collapsed,
  onSelect
}: SidebarItemProps): React.JSX.Element {
  const Icon = entry.icon

  const button = (
    <Button
      variant="ghost"
      onClick={() => onSelect?.(entry)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative h-10 w-full justify-start gap-3 rounded-md px-3 text-sm',
        collapsed && 'justify-center px-0',
        active
          ? 'bg-surface-sidebar-hover font-medium text-surface-sidebar-text-active'
          : 'text-surface-sidebar-text hover:bg-surface-sidebar-hover hover:text-surface-sidebar-text-active'
      )}
    >
      {active && (
        <span className="absolute left-0 h-5 w-1 rounded-r-full bg-brand" aria-hidden="true" />
      )}
      <Icon className={cn('size-4 shrink-0', active && 'text-brand')} />
      {!collapsed && <span className="truncate">{entry.label}</span>}
    </Button>
  )

  if (!collapsed) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right">{entry.label}</TooltipContent>
    </Tooltip>
  )
}
