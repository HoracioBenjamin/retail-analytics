import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { VariantRow } from '@shared/schemas'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { SectionCard } from '@/components/shared/SectionCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { FilterBar } from '@/components/shared/FilterBar'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DemoChip } from '@/components/shared/DemoChip'
import { VariantDetailSheet } from '@/components/shared/VariantDetailSheet'
import { useFiltersAvailability, useVariantRows } from '@/hooks/api'
import { fmtCoverage, fmtNum } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Pantalla Variantes e inventario (plan, sección 8 "/variants"): tabla con
 * identificador, modelo, color, talla, stock, ventas del período, pronóstico
 * de ejemplo, cobertura y estado; búsqueda, ordenación y detalle lateral.
 * Busca, ordena y pagina localmente sobre las filas completas del fixture.
 */

type SortKey =
  | 'model'
  | 'color'
  | 'size'
  | 'stock_on_hand'
  | 'units_sold_period'
  | 'forecast_units_total'
  | 'coverage_weeks'

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'model', label: 'Modelo · Color · Talla' },
  { key: 'stock_on_hand', label: 'Stock', numeric: true },
  { key: 'units_sold_period', label: 'Ventas del período', numeric: true },
  { key: 'forecast_units_total', label: 'Pronóstico ejemplo', numeric: true },
  { key: 'coverage_weeks', label: 'Cobertura', numeric: true }
]

const PAGE_SIZE = 10

export function VariantsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('model')
  const [sortAsc, setSortAsc] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const rowsQuery = useVariantRows()
  const availability = useFiltersAvailability()

  const applyParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    setPage(1)
  }

  const filtered = useMemo(() => {
    const model = params.get('modelo')
    const color = params.get('color')
    const size = params.get('talla')
    const risk = params.get('riesgo')
    const q = search.trim().toLowerCase()
    return (rowsQuery.data ?? []).filter((r) => {
      if (model && r.model !== model) return false
      if (color && r.color !== color) return false
      if (size && r.size !== size) return false
      if (risk && r.risk !== risk) return false
      if (q) {
        const haystack =
          `${r.variant_id} ${r.model} ${r.color} ${r.size} ${r.sku ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
  }, [rowsQuery.data, params, search])

  const sorted = useMemo(() => {
    const mult = sortAsc ? 1 : -1
    return [...filtered].sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * mult
      const sa = String(va ?? '')
      const sb = String(vb ?? '')
      return new Intl.Collator('es', { numeric: true }).compare(sa, sb) * mult
    })
  }, [filtered, sortKey, sortAsc])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageRows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const toggleSort = (key: SortKey): void => {
    if (key === sortKey) {
      setSortAsc((prev) => !prev)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Variantes e inventario"
          description="Variante = modelo + color + talla. Los datos provienen del dataset de demostración (corte incluido en la cabecera)."
          actions={<DemoChip />}
        />

        <FilterBar
          onClear={() => {
            setParams(new URLSearchParams(), { replace: true })
            setSearch('')
            setPage(1)
          }}
        >
          <span className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Buscar id, modelo, SKU…"
              className="h-9 w-64 pl-8 text-xs"
            />
          </span>
          <ValueSelect
            placeholder="Todos los modelos"
            allLabel="Todos los modelos"
            value={params.get('modelo') ?? 'all'}
            values={availability.data?.models ?? []}
            onChange={(v) => applyParam('modelo', v)}
            className="w-44"
          />
          <ValueSelect
            placeholder="Todos los colores"
            allLabel="Todos los colores"
            value={params.get('color') ?? 'all'}
            values={availability.data?.colors ?? []}
            onChange={(v) => applyParam('color', v)}
            className="w-36"
          />
          <ValueSelect
            placeholder="Todas las tallas"
            allLabel="Todas las tallas"
            value={params.get('talla') ?? 'all'}
            values={availability.data?.sizes ?? []}
            onChange={(v) => applyParam('talla', v)}
            className="w-32"
            prefix="Talla "
          />
          <ValueSelect
            placeholder="Todos los estados"
            allLabel="Todos los estados"
            value={params.get('riesgo') ?? 'all'}
            values={['stockout', 'excess', 'balanced', 'insufficient_data']}
            labels={{
              stockout: 'Riesgo de faltante',
              excess: 'Exceso',
              balanced: 'Equilibrado',
              insufficient_data: 'Datos insuficientes'
            }}
            onChange={(v) => applyParam('riesgo', v)}
            className="w-44"
          />
        </FilterBar>

        <SectionCard
          title="Listado de variantes"
          description={`${sorted.length} de ${rowsQuery.data?.length ?? 0} variantes · orden y paginación locales sobre el mismo dataset`}
          contentClassName="p-2"
        >
          {rowsQuery.isPending ? (
            <LoadingState rows={4} />
          ) : rowsQuery.isError ? (
            <ErrorState
              code={
                rowsQuery.error instanceof Error
                  ? (rowsQuery.error as Error & { code?: string }).code
                  : undefined
              }
              message={
                rowsQuery.error instanceof Error ? rowsQuery.error.message : String(rowsQuery.error)
              }
              onRetry={() => void rowsQuery.refetch()}
            />
          ) : pageRows.length === 0 ? (
            <EmptyState
              title="Sin variantes para la búsqueda"
              description="Revisa el texto de búsqueda o limpia los filtros con el botón Limpiar."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((col) => (
                      <TableHead
                        key={col.key}
                        className={cn('text-xs', col.numeric && 'text-right')}
                      >
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort(col.key)}
                        >
                          {col.label}
                          {sortKey === col.key ? (
                            sortAsc ? (
                              <ArrowUp className="size-3" aria-hidden="true" />
                            ) : (
                              <ArrowDown className="size-3" aria-hidden="true" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" aria-hidden="true" />
                          )}
                        </button>
                      </TableHead>
                    ))}
                    <TableHead className="w-[150px] text-xs">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => (
                    <VariantRowView
                      key={r.variant_id}
                      row={r}
                      onOpen={() => setSelectedVariantId(r.variant_id)}
                    />
                  ))}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Página {current} de {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current <= 1}
                    onClick={() => setPage(current - 1)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={current >= totalPages}
                    onClick={() => setPage(current + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            </>
          )}
        </SectionCard>

        <VariantDetailSheet variantId={selectedVariantId} onOpenChange={setSelectedVariantId} />
      </div>
    </>
  )
}

function VariantRowView({
  row,
  onOpen
}: {
  row: VariantRow
  onOpen: () => void
}): React.JSX.Element {
  return (
    <TableRow className="cursor-pointer hover:bg-muted/40" onClick={onOpen}>
      <TableCell className="text-xs">
        <p className="font-medium">{row.model}</p>
        <p className="text-muted-foreground">
          {row.color} · T{row.size} <span className="font-mono">({row.variant_id})</span>
        </p>
      </TableCell>
      <TableCell className="text-right text-xs">{fmtNum(row.stock_on_hand)}</TableCell>
      <TableCell className="text-right text-xs">{fmtNum(row.units_sold_period)}</TableCell>
      <TableCell className="text-right text-xs">
        {row.forecast_units_total === null ? '—' : `${fmtNum(row.forecast_units_total)} uds`}
      </TableCell>
      <TableCell className="text-right text-xs">{fmtCoverage(row.coverage_weeks)}</TableCell>
      <TableCell>
        <StatusBadge risk={row.risk} />
      </TableCell>
    </TableRow>
  )
}

function ValueSelect({
  placeholder,
  allLabel,
  value,
  values,
  labels,
  onChange,
  className,
  prefix = ''
}: {
  placeholder: string
  allLabel: string
  value: string
  values: readonly string[]
  labels?: Record<string, string>
  onChange: (v: string) => void
  className?: string
  prefix?: string
}): React.JSX.Element {
  return (
    <Select value={value || 'all'} onValueChange={onChange}>
      <SelectTrigger className={cn('h-9 text-xs', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          {allLabel}
        </SelectItem>
        {values.map((v) => (
          <SelectItem key={v} value={v} className="text-xs">
            {labels?.[v] ?? `${prefix}${v}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
