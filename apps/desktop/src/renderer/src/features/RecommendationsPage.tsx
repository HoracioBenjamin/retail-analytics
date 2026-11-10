import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RecommendationAction, RiskLevel } from '@shared/schemas'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/shared/SearchableSelect'
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
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { VariantDetailSheet } from '@/components/shared/VariantDetailSheet'
import { useDatasetMetadata, useRecommendations, useVariantRows } from '@/hooks/api'
import { fmtCoverage, fmtNum } from '@/lib/format'
import { textMatches } from '@/lib/search'
import { cn } from '@/lib/utils'
import {
  isMissingSupplierLeadTime,
  recommendationActionLabel,
  recommendationQuantityLabel,
  recommendationReasonLabel
} from '@/lib/recommendationPresentation'

/**
 * Pantalla Recomendaciones (plan, sección 8 "/recommendations"): lista de
 * prioridades con acción, cantidad sugerida cuando exista, cobertura,
 * explicación de la regla y filtro de estado. Reglas ilustrativas, resueltas
 * en el proveedor/fixture (nunca dentro de los componentes visuales).
 */

const ACTION_BADGE_CLASSES: Record<RecommendationAction, string> = {
  replenish: 'bg-status-stockout/10 text-status-stockout border-transparent',
  maintain: 'bg-status-balanced/10 text-status-balanced border-transparent',
  defer_purchase: 'bg-status-excess/10 text-status-excess border-transparent',
  review_data: 'bg-status-insufficient/10 text-status-insufficient border-transparent'
}

const PAGE_SIZE = 10

export function RecommendationsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  const recs = useRecommendations({})
  const rows = useVariantRows()

  const byVariant = useMemo(
    () => new Map((rows.data ?? []).map((r) => [r.variant_id, r])),
    [rows.data]
  )

  const risk = params.get('riesgo') as RiskLevel | null
  const filtered = useMemo(() => {
    let base = recs.data ?? []
    if (risk) base = base.filter((r) => r.risk === risk)
    if (search.trim()) {
      base = base.filter((r) => {
        const row = byVariant.get(r.variant_id)
        return textMatches(search, r.variant_id, r.reason, row?.model, row?.color, row?.size)
      })
    }
    return base
  }, [byVariant, recs.data, risk, search])

  const counts = useMemo(() => {
    const map: Record<RiskLevel, number> = {
      stockout: 0,
      excess: 0,
      balanced: 0,
      insufficient_data: 0
    }
    for (const r of recs.data ?? []) map[r.risk] += 1
    return map
  }, [recs.data])

  const conectado = useDatasetMetadata()?.data_mode === 'connected'

  // Paginador (máx. 10 filas por página, mismo patrón de Variantes):
  // `current` se amarra al rango válido para que un cambio de filtro
  // nunca deje una página imposible.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, totalPages)
  const pageRows = useMemo(
    () => filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE),
    [current, filtered]
  )

  return (
    <>
      <div className="space-y-4">
        <PageHeader
          title="Recomendaciones"
          description={
            conectado
              ? 'Estimaciones prudentes basadas en las ventas registradas. Para anticipar faltantes se necesita suficiente historial y conocer el plazo del proveedor; si faltan esos datos, se recomienda revisar.'
              : 'Prioridades calculadas por la regla ilustrativa del plan (9.3) sobre el dataset local. No es un motor de decisión definitivo.'
          }
        />

        <FilterBar>
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value)
              setPage(1)
            }}
            placeholder="Buscar variante o explicación…"
            ariaLabel="Buscar recomendación por variante o explicación"
            className="w-64"
          />
          <SearchableSelect
            value={risk ?? 'all'}
            label="Estados"
            className="w-56"
            onValueChange={(v) => {
              const next = new URLSearchParams(params)
              if (v === 'all') next.delete('riesgo')
              else next.set('riesgo', v)
              setParams(next, { replace: true })
              setPage(1)
            }}
            options={[
              { value: 'all', label: 'Todos los estados (' + (recs.data?.length ?? 0) + ')' },
              { value: 'stockout', label: 'Riesgo de faltante (' + counts.stockout + ')' },
              { value: 'excess', label: 'Exceso de inventario (' + counts.excess + ')' },
              { value: 'balanced', label: 'Equilibrado (' + counts.balanced + ')' },
              {
                value: 'insufficient_data',
                label: 'Datos insuficientes (' + counts.insufficient_data + ')'
              }
            ]}
          />
        </FilterBar>

        <SectionCard
          title="Prioridades por variante"
          description="Orden: reponer → no comprar por ahora → evaluar datos pendientes → mantener. Las cantidades indican unidades adicionales a comprar."
          contentClassName="p-2"
        >
          {recs.isPending ? (
            <LoadingState rows={4} />
          ) : recs.isError ? (
            <ErrorState
              code={
                recs.error instanceof Error
                  ? (recs.error as Error & { code?: string }).code
                  : undefined
              }
              message={recs.error instanceof Error ? recs.error.message : String(recs.error)}
              onRetry={() => void recs.refetch()}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Sin recomendaciones para este filtro"
              description="Elige otro estado o revisa el Estado de datos del dataset."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-3 text-xs">Variante</TableHead>
                    <TableHead className="w-44 px-3 text-xs">Acción</TableHead>
                    <TableHead className="w-20 px-3 text-right text-xs">Stock</TableHead>
                    <TableHead className="w-36 px-3 text-right text-xs">Compra sugerida</TableHead>
                    <TableHead className="w-20 px-3 text-right text-xs">Cobertura</TableHead>
                    <TableHead className="w-40 px-3 text-xs">Estado</TableHead>
                    <TableHead className="px-3 text-xs">Explicación</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((r) => {
                    const row = byVariant.get(r.variant_id)
                    return (
                      <TableRow
                        key={r.variant_id}
                        className="cursor-pointer align-top hover:bg-muted/40"
                        onClick={() => setSelectedVariantId(r.variant_id)}
                      >
                        <TableCell className="max-w-[280px] px-3 py-2 text-xs">
                          <p className="truncate font-medium">
                            {row ? `${row.model} · ${row.color} · T${row.size}` : r.variant_id}
                          </p>
                          <p className="truncate font-mono text-[10px] text-muted-foreground">
                            {r.variant_id}
                          </p>
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              'whitespace-nowrap text-xs font-medium',
                              ACTION_BADGE_CLASSES[r.action]
                            )}
                          >
                            {recommendationActionLabel(r)}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs">
                          {row ? `${fmtNum(row.stock_on_hand)} uds` : 'No disponible'}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs">
                          {recommendationQuantityLabel(r)}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-right text-xs">
                          {fmtCoverage(r.coverage_weeks)}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <StatusBadge
                            risk={r.risk}
                            label={
                              isMissingSupplierLeadTime(r) ? 'Reposición por evaluar' : undefined
                            }
                            className="whitespace-nowrap"
                          />
                        </TableCell>
                        <TableCell className="min-w-[220px] px-3 py-2 text-xs text-muted-foreground">
                          <span className="line-clamp-2" title={recommendationReasonLabel(r)}>
                            {recommendationReasonLabel(r)}
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between border-t px-3 py-2.5">
                <p className="text-xs text-muted-foreground">
                  Página {current} de {totalPages} · {filtered.length} recomendaciones
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={current <= 1}
                    onClick={() => {
                      setPage(current - 1)
                      setSelectedVariantId(null)
                    }}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={current >= totalPages}
                    onClick={() => {
                      setPage(current + 1)
                      setSelectedVariantId(null)
                    }}
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
