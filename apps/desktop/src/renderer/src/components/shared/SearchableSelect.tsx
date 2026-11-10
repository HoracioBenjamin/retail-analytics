import { useId, useRef, useState } from 'react'
import { Popover } from 'radix-ui'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '../../lib/utils'

type Option = { value: string; label: string }
const PAGE_SIZE = 50
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es')
    .trim()

/** Filtro compartido: búsqueda local, scroll y páginas para catálogos extensos. */
export function SearchableSelect({
  value,
  onValueChange,
  options,
  label,
  className,
  placeholder = 'Seleccionar',
  disabled = false
}: {
  value: string
  onValueChange: (value: string) => void
  options: readonly Option[]
  label: string
  className?: string
  placeholder?: string
  disabled?: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(0)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const filtered = options.filter((option) => normalize(option.label).includes(normalize(query)))
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages - 1)
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const selected = options.find((option) => option.value === value)
  const activeIndex = active < visible.length ? active : -1

  function select(option: Option): void {
    onValueChange(option.value)
    setOpen(false)
  }

  function changePage(next: number): void {
    setPage(next)
    setActive(-1)
    listRef.current?.scrollTo?.({ top: 0 })
    inputRef.current?.focus()
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setQuery('')
          const index = options.findIndex((option) => option.value === value)
          setPage(index < 0 ? 0 : Math.floor(index / PAGE_SIZE))
          setActive(-1)
        }
      }}
    >
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          className={cn(
            'flex h-9 min-w-0 items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
            className
          )}
        >
          <span className="truncate">{selected?.label ?? (value || placeholder)}</span>
          <ChevronDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 flex max-h-[var(--radix-popover-content-available-height)] w-[max(16rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              role="combobox"
              aria-label={`Buscar en ${label}`}
              aria-controls={listId}
              aria-expanded={open}
              aria-autocomplete="list"
              aria-activedescendant={activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
              placeholder="Buscar…"
              value={query}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              onChange={(event) => {
                setQuery(event.target.value)
                setPage(0)
                setActive(-1)
                listRef.current?.scrollTo?.({ top: 0 })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  const option = visible[activeIndex >= 0 ? activeIndex : 0]
                  if (option) select(option)
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  if (visible.length === 0) return
                  const next =
                    event.key === 'ArrowDown'
                      ? (activeIndex + 1) % visible.length
                      : activeIndex <= 0
                        ? visible.length - 1
                        : activeIndex - 1
                  setActive(next)
                  document
                    .getElementById(`${listId}-${next}`)
                    ?.scrollIntoView?.({ block: 'nearest' })
                }
              }}
            />
          </div>
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            className="min-h-0 max-h-60 overflow-y-scroll overscroll-contain p-1"
            style={{ scrollbarGutter: 'stable', scrollbarWidth: 'auto' }}
          >
            {visible.map((option, index) => (
              <button
                key={option.value}
                id={`${listId}-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === value}
                tabIndex={-1}
                className={cn(
                  'flex w-full items-center justify-between gap-3 rounded-sm px-2 py-2 text-left text-xs break-words hover:bg-accent hover:text-accent-foreground',
                  activeIndex === index && 'bg-accent text-accent-foreground'
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
              >
                <span className="min-w-0">{option.label}</span>
                {option.value === value && <Check className="size-4 shrink-0" aria-hidden="true" />}
              </button>
            ))}
            {visible.length === 0 && (
              <p className="px-2 py-5 text-center text-xs text-muted-foreground">Sin resultados</p>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
            <span role="status" aria-live="polite">
              {filtered.length} opciones{pages > 1 ? ` · ${currentPage + 1}/${pages}` : ''}
            </span>
            {pages > 1 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded px-1 hover:bg-accent disabled:opacity-40"
                  disabled={currentPage === 0}
                  onClick={() => changePage(currentPage - 1)}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded px-1 hover:bg-accent disabled:opacity-40"
                  disabled={currentPage === pages - 1}
                  onClick={() => changePage(currentPage + 1)}
                >
                  Siguiente
                </button>
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
