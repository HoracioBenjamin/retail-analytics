import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RecommendationAction, RiskLevel } from '@shared/schemas'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
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
import { DemoChip, ModelPendingNote } from '@/components/shared/DemoChip'
import { VariantDetailSheet } from '@/components/shared/VariantDetailSheet'
import { useRecommendations, useVariantRows } from '@/hooks/api'
import { fmtCoverage, fmtNum } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Pantalla Recomendaciones (plan, sección 8 "/recommendations"): lista de
 * prioridades con acción, cantidad sugerida cuando exista, cobertura,
 * explicación de la regla y filtro de estado. Reglas ilustrativas, resueltas
 * en el proveedor/fixture (nunca dentro de los componentes visuales).
 */

const ACTION_LABELS: Record<RecommendationAction, string> = {
  replenish: 'Reponer',
  maintain: 'Mantener',
  defer_purchase: 'Posponer compras',
  review_data: 'Revisar datos'
}

const ACTION_BADGE_CLASSES: Record<RecommendationAction, string> = {
  replenish: 'bg-status-stockout/10 text-status-stockout border-transparent',
  maintain: 'bg-status-balanced/10 text-status-balanced border-transparent',
  defer_purchase: 'bg-status-excess/10 text-status-excess border-transparent',
  review_data: 'bg-status-insufficient/10 text-status-insufficient border-transparent'
}

export function RecommendationsPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const recs = useRecommendations({})
  const rows = useVariantRows()

  const byVariant = useMemo(
    () => new Map((rows.data ?? []).map((r) => [r.variant_id, r])),
    [rows.data]
  )

  const risk = params.get('riesgo') as RiskLevel | null
  const filtered = useMemo(() => {
    const base = recs.data ?? []
    return risk ? base.filter((r) => r.risk === risk) : base
  }, [recs.data, risk])

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

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title="Recomendaciones"
          description="Prioridades calculadas por la regla ilustrativa del plan (9.3) sobre el dataset de demostración. No es un motor de decisión definitivo."
          actions={<DemoChip />}
        />

        <ModelPendingNote />

        <FilterBar>
          <Select
            value={risk ?? 'all'}
            onValueChange={(v) => {
              const next = new URLSearchParams(params)
              if (v === 'all') next.delete('riesgo')
              else next.set('riesgo', v)
              setParams(next, { replace: true })
            }}
          >
            <SelectTrigger className="h-9 w-56 text-xs">
              <SelectValue placeholder="Todos los estados" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Todos los estados ({recs.data?.length ?? 0})
              </SelectItem>
              <SelectItem value="stockout" className="text-xs">
                Riesgo de faltante ({counts.stockout})
              </SelectItem>
              <SelectItem value="excess" className="text-xs">
                Exceso / baja rotación ({counts.excess})
              </SelectItem>
              <SelectItem value="balanced" className="text-xs">
                Equilibrado ({counts.balanced})
              </SelectItem>
              <SelectItem value="insufficient_data" className="text-xs">
                Datos insuficientes ({counts.insufficient_data})
              </SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        <SectionCard
          title="Prioridades por variante"
          description="Orden: reponer → posponer compras → revisar datos → mantener."
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Variante</TableHead>
                  <TableHead className="w-40 text-xs">Acción</TableHead>
                  <TableHead className="w-32 text-right text-xs">Cantidad sugerida</TableHead>
                  <TableHead className="w-28 text-right text-xs">Cobertura</TableHead>
                  <TableHead className="w-44 text-xs">Estado</TableHead>
                  <TableHead className="text-xs">Explicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const row = byVariant.get(r.variant_id)
                  return (
                    <TableRow
                      key={r.variant_id}
                      className="cursor-pointer align-top hover:bg-muted/40"
                      onClick={() => setSelectedVariantId(r.variant_id)}
                    >
                      <TableCell className="text-xs">
                        <p className="font-medium">
                          {row ? `${row.model} · ${row.color} · T${row.size}` : r.variant_id}
                        </p>
                        <p className="font-mono text-muted-foreground">{r.variant_id}</p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-xs font-medium', ACTION_BADGE_CLASSES[r.action])}
                        >
                          {ACTION_LABELS[r.action]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {r.suggested_units === null ? '—' : `${fmtNum(r.suggested_units)} uds`}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {fmtCoverage(r.coverage_weeks)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge risk={r.risk} />
                      </TableCell>
                      <TableCell className="max-w-[420px] text-xs text-muted-foreground">
                        <span className="line-clamp-3">{r.reason}</span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </SectionCard>

        <VariantDetailSheet variantId={selectedVariantId} onOpenChange={setSelectedVariantId} />
      </div>
    </>
  )
}
