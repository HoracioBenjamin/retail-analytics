import { useMemo, useState } from 'react'
import { ShoppingBag, TriangleAlert, Wallet, PackageOpen } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import type { ForecastPoint, SalesPoint, VariantRow } from '@shared/schemas'
import { PageHeader } from '@/components/layout/PageHeader'
import { SectionCard } from '@/components/shared/SectionCard'
import { KpiCard } from '@/components/shared/KpiCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { LoadingState } from '@/components/shared/LoadingState'
import { FilterBar } from '@/components/shared/FilterBar'
import { SearchInput } from '@/components/shared/SearchInput'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { HistoryForecastChart } from '@/components/shared/HistoryForecastChart'
import { VariantDetailSheet } from '@/components/shared/VariantDetailSheet'
import {
  useDataStatus,
  useDatasetMetadata,
  useFiltersAvailability,
  useForecastSeries,
  useOverview,
  useRecommendations,
  useVariantRows
} from '@/hooks/api'
import { fmtCLP, fmtCoverage, fmtNum, weekLabel } from '@/lib/format'
import { textMatches } from '@/lib/search'
import { PERIOD_LABELS, buildDateRange, type Periodo } from './periodRange'
import {
  isMissingSupplierLeadTime,
  recommendationActionLabel,
  recommendationQuantityLabel,
  recommendationReasonLabel
} from '@/lib/recommendationPresentation'
import { Link } from 'react-router-dom'

/**
 * Pantalla Resumen (plan, sección 8 "/overview"): filtros compartidos,
 * cuatro KPIs derivados de la fuente activa, dos paneles de riesgo, gráfico
 * histórico/futuro, rankings y recomendaciones prioritarias.
 * Todos los valores se derivan del dataset; nada está escrito a mano.
 */

export function OverviewPage(): React.JSX.Element {
  const [params, setParams] = useSearchParams()
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null)

  const periodo = (params.get('periodo') as Periodo | null) ?? 'all'

  // Para computar el rango de fecha del preset necesitamos el corte del dataset.
  const status = useDataStatus()
  const conectado = useDatasetMetadata()?.data_mode === 'connected'
  const histEnd = status.data?.metadata.historical_range?.end ?? null
  const effectiveFilters = useMemo(() => {
    const dateRange = buildDateRange(periodo, histEnd)
    return {
      ...dateRange,
      model: params.get('modelo') ?? undefined,
      color: params.get('color') ?? undefined,
      size: params.get('talla') ?? undefined
    }
  }, [params, histEnd, periodo])

  const overview = useOverview(effectiveFilters)
  const variantRows = useVariantRows()
  const recs = useRecommendations({})
  const availability = useFiltersAvailability()
  const selectedModel = params.get('modelo')
  const selectedModelName =
    availability.data?.models.find((model) => model === selectedModel) ?? selectedModel

  const rows = useMemo(() => variantRows.data ?? [], [variantRows.data])
  // Búsqueda de la FilterBar: restringe las LISTAS y candidatas del gráfico
  // (paneles de riesgo, rankings, selector del gráfico). Los KPIs siguen
  // respondiendo a los selects: son agregados del servicio, no de la vista.
  const [search, setSearch] = useState('')
  const rowsFiltered = useMemo(
    () =>
      search.trim()
        ? rows.filter((r) => textMatches(search, r.variant_id, r.model, r.color, r.size))
        : rows,
    [rows, search]
  )
  const stockoutRows = useMemo(
    () =>
      rowsFiltered
        .filter((r) => r.risk === 'stockout')
        .sort((a, b) => (a.coverage_weeks ?? 99) - (b.coverage_weeks ?? 99)),
    [rowsFiltered]
  )
  const excessRows = useMemo(
    () =>
      rowsFiltered
        .filter((r) => r.risk === 'excess')
        .sort((a, b) => (b.coverage_weeks ?? 0) - (a.coverage_weeks ?? 0)),
    [rowsFiltered]
  )
  const topDemanda = useMemo(
    () => [...rowsFiltered].sort((a, b) => b.units_sold_period - a.units_sold_period).slice(0, 5),
    [rowsFiltered]
  )
  const topAcumulacion = useMemo(
    () =>
      [...rowsFiltered]
        .filter((r) => r.action === 'defer_purchase')
        .sort((a, b) => (b.coverage_weeks ?? 0) - (a.coverage_weeks ?? 0))
        .slice(0, 5),
    [rowsFiltered]
  )
  const topRecommendations = useMemo(
    () => (recs.data ?? []).filter((r) => r.action !== 'maintain').slice(0, 5),
    [recs.data]
  )
  const blockedRecommendations = useMemo(
    () =>
      (recs.data ?? [])
        .filter(isMissingSupplierLeadTime)
        .sort((a, b) => (a.coverage_weeks ?? Infinity) - (b.coverage_weeks ?? Infinity)),
    [recs.data]
  )

  // Series del gráfico de ejemplo: variante seleccionada (default: primera en riesgo).
  const chartVariantId =
    selectedVariantId ??
    stockoutRows.at(0)?.variant_id ??
    rowsFiltered.find((row) => row.forecast_units_total !== null)?.variant_id ??
    rowsFiltered.at(0)?.variant_id ??
    null

  const applyParam = (key: string, value: string): void => {
    const next = new URLSearchParams(params)
    if (value === 'all') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  // ── Render ──
  return (
    <>
      <div className="space-y-6">
        <PageHeader
          title={
            selectedModelName ? `Resumen · ${selectedModelName}` : 'Resumen de ventas e inventario'
          }
          description={[
            selectedModelName ? `Zapatilla: ${selectedModelName}` : 'Todas las zapatillas',
            params.get('color') ? `Color: ${params.get('color')}` : null,
            params.get('talla') ? `Talla: ${params.get('talla')}` : null,
            overview.data?.period_start && overview.data.period_end
              ? `Fechas de venta: ${overview.data.period_start} al ${overview.data.period_end}`
              : `Período: ${PERIOD_LABELS[periodo]}`
          ]
            .filter(Boolean)
            .join(' · ')}
        />

        <FilterBar>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Buscar en listas (modelo, color, talla)…"
            ariaLabel="Buscar en las listas del resumen"
            className="w-64"
          />
          <PeriodSelect value={periodo} onChange={(v) => applyParam('periodo', v)} />
          <ModelSelect
            availability={availability.data}
            value={params.get('modelo') ?? 'all'}
            onChange={(v) => applyParam('modelo', v)}
          />
          <ColorSelect
            availability={availability.data}
            value={params.get('color') ?? 'all'}
            onChange={(v) => applyParam('color', v)}
          />
          <SizeSelect
            availability={availability.data}
            value={params.get('talla') ?? 'all'}
            onChange={(v) => applyParam('talla', v)}
          />
        </FilterBar>

        {overview.isPending || status.isPending ? (
          <LoadingState rows={2} />
        ) : overview.isError ? (
          <ErrorState
            code={
              overview.error instanceof Error
                ? (overview.error as Error & { code?: string }).code
                : undefined
            }
            message={
              overview.error instanceof Error ? overview.error.message : String(overview.error)
            }
            onRetry={() => void overview.refetch()}
          />
        ) : (
          <>
            {/* KPIs del período */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                label="Unidades vendidas"
                icon={ShoppingBag}
                value={fmtNum(overview.data.units_sold)}
                hint={periodLabelHint(
                  periodo,
                  overview.data.period_start,
                  overview.data.period_end
                )}
              />
              <KpiCard
                label="Importe de ventas (CLP)"
                icon={Wallet}
                value={fmtCLP(overview.data.sales_amount_clp)}
                hint={
                  conectado
                    ? 'Unidades × precio real (pedidos confirmados)'
                    : 'Unidades × precio efectivo, líneas del fixture'
                }
              />
              <KpiCard
                label="Variantes con riesgo de faltante"
                icon={TriangleAlert}
                value={fmtNum(overview.data.risk_counts.stockout)}
                hint={`${fmtNum(overview.data.variants_total)} variantes en el período`}
              />
              <KpiCard
                label="Variantes con exceso"
                icon={PackageOpen}
                value={fmtNum(overview.data.risk_counts.excess)}
                hint={`${fmtNum(overview.data.variants_at_risk)} variantes con riesgo comercial`}
              />
            </div>

            {/* Paneles de riesgo */}
            <div className="grid gap-4 lg:grid-cols-2">
              <RiskPanel
                title="Riesgo de agotamiento"
                description={
                  conectado
                    ? 'La demanda se estima con las ventas registradas. Para anticipar faltantes con mayor precisión se necesita suficiente historial y conocer el plazo del proveedor.'
                    : 'Cobertura menor que el plazo del proveedor.'
                }
                rows={stockoutRows}
                emptyTitle="Sin variantes en riesgo de faltante"
                emptyDesc="Ninguna variante filtrada tiene cobertura bajo el umbral en el período."
                onSelect={setSelectedVariantId}
              />
              <RiskPanel
                title="Exceso de inventario"
                description="Cobertura sobre el umbral de exceso (8 semanas)."
                rows={excessRows}
                emptyTitle="Sin variantes en exceso"
                emptyDesc="Ninguna variante filtrada supera el umbral de cobertura en el período."
                onSelect={setSelectedVariantId}
              />
            </div>

            {/* Gráfico de ejemplo + rankings */}
            <div className="grid gap-4 lg:grid-cols-3">
              <SectionCard
                className="lg:col-span-2"
                title={
                  conectado
                    ? 'Ventas registradas y demanda estimada'
                    : 'Ventas históricas y proyección local'
                }
                description={
                  conectado
                    ? 'La línea discontinua muestra una estimación para las próximas 4 semanas; su precisión aún no se ha validado.'
                    : 'La línea discontinua es un valor local del dataset, no una predicción de modelo.'
                }
              >
                <VariantChartBlock
                  chartVariantId={chartVariantId}
                  onSelectVariant={setSelectedVariantId}
                  rows={rowsFiltered}
                />
              </SectionCard>

              <div className="grid content-start gap-4">
                <SectionCard
                  title="Variantes más demandadas"
                  description="Unidades vendidas del período filtrado."
                >
                  <RankingList
                    items={topDemanda.map((r) => ({
                      id: r.variant_id,
                      label: `${r.model} · ${r.color} · T${r.size}`,
                      value: `${fmtNum(r.units_sold_period)} ${r.units_sold_period === 1 ? 'unidad' : 'unidades'}`
                    }))}
                    onSelect={setSelectedVariantId}
                    emptyTitle="Sin ventas en el período"
                  />
                </SectionCard>
                <SectionCard
                  title="Mayor acumulación"
                  description="Cobertura informativa de las variantes con exceso."
                >
                  <RankingList
                    items={topAcumulacion.map((r) => ({
                      id: r.variant_id,
                      label: `${r.model} · ${r.color} · T${r.size}`,
                      value: fmtCoverage(r.coverage_weeks)
                    }))}
                    onSelect={setSelectedVariantId}
                    emptyTitle="Sin exceso de inventario"
                  />
                </SectionCard>
              </div>
            </div>

            {/* Recomendaciones prioritarias */}
            <SectionCard
              title="Recomendaciones prioritarias"
              description="Hasta 5 acciones del catálogo: reponer → no comprar por ahora → revisar datos. La demanda y la cobertura se evalúan por separado."
            >
              {blockedRecommendations.length > 0 && (
                <div className="mb-3 space-y-2 rounded-lg border bg-muted/40 p-3 text-xs">
                  <p className="font-medium">
                    Falta plazo del proveedor · {blockedRecommendations.length} variantes por
                    evaluar
                  </p>
                  <p className="text-muted-foreground">
                    La cobertura indica cuánto podría durar el stock. Sin el plazo de entrega, aún
                    no se determina si conviene comprar más.
                  </p>
                  <ul className="space-y-1.5">
                    {blockedRecommendations.slice(0, 3).map((r) => {
                      const row = rows.find((x) => x.variant_id === r.variant_id)
                      return (
                        <li key={r.variant_id}>
                          <button
                            type="button"
                            className="w-full text-left hover:underline"
                            onClick={() => setSelectedVariantId(r.variant_id)}
                          >
                            {row ? `${row.model} · ${row.color} · T${row.size}` : r.variant_id}
                            <span className="block text-muted-foreground">
                              Stock: {row ? `${fmtNum(row.stock_on_hand)} uds` : 'No disponible'} ·
                              Cobertura estimada: {fmtCoverage(r.coverage_weeks)}
                            </span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  <Link
                    className="inline-block underline underline-offset-2"
                    to="/recommendations?riesgo=insufficient_data"
                  >
                    Ver casos pendientes en Recomendaciones
                  </Link>
                </div>
              )}
              {topRecommendations.length === 0 ? (
                <EmptyState
                  title="Sin recomendaciones activas"
                  description="Ninguna variante requiere acción en el ámbito filtrado."
                />
              ) : (
                <ul className="divide-y">
                  {topRecommendations.map((r) => {
                    const row = rows.find((x) => x.variant_id === r.variant_id)
                    return (
                      <li key={r.variant_id}>
                        <button
                          className="flex w-full flex-col items-start justify-between gap-3 py-3 text-left hover:bg-muted/40 sm:flex-row"
                          onClick={() => setSelectedVariantId(r.variant_id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {row ? `${row.model} · ${row.color} · T${row.size}` : r.variant_id}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {recommendationReasonLabel(r)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Stock: {row ? `${fmtNum(row.stock_on_hand)} uds` : 'No disponible'} ·
                              Cobertura estimada: {fmtCoverage(r.coverage_weeks)}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                            <StatusBadge
                              risk={r.risk}
                              label={
                                isMissingSupplierLeadTime(r) ? 'Reposición por evaluar' : undefined
                              }
                            />
                            <span className="text-xs font-medium">
                              {recommendationActionLabel(r)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {recommendationQuantityLabel(r)}
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </SectionCard>
          </>
        )}

        <VariantDetailSheet variantId={selectedVariantId} onOpenChange={setSelectedVariantId} />
      </div>
    </>
  )
}

/* ── Bloques internos ── */

function periodLabelHint(periodo: Periodo, start: string | null, end: string | null): string {
  if (start && end) return `${weekLabel(start)} – ${weekLabel(end)}`
  void PERIOD_LABELS[periodo]
  return ''
}

function RiskPanel({
  title,
  description,
  rows,
  emptyTitle,
  emptyDesc,
  onSelect
}: {
  title: string
  description: string
  rows: VariantRow[]
  emptyTitle: string
  emptyDesc: string
  onSelect: (id: string) => void
}): React.JSX.Element {
  const visible = rows.slice(0, 6)
  return (
    <SectionCard title={title} description={description}>
      {visible.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDesc} />
      ) : (
        <ul className="divide-y">
          {visible.map((r) => (
            <li key={r.variant_id}>
              <button
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/40"
                onClick={() => onSelect(r.variant_id)}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {r.model} · {r.color} · T{r.size}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Inventario: {fmtNum(r.stock_on_hand)}{' '}
                    {r.stock_on_hand === 1 ? 'unidad' : 'unidades'} ·{' '}
                    {fmtCoverage(r.coverage_weeks)}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-0.5">
                  <span
                    className={
                      r.risk === 'stockout'
                        ? 'text-xs font-semibold text-status-stockout'
                        : 'text-xs font-semibold text-status-excess'
                    }
                  >
                    {r.risk === 'stockout'
                      ? `Reponer ${r.suggested_units !== null ? fmtNum(r.suggested_units) : '—'} ${r.suggested_units === 1 ? 'unidad' : 'unidades'}`
                      : 'No comprar por ahora · 0 unidades sugeridas'}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function RankingList({
  items,
  emptyTitle,
  onSelect
}: {
  items: Array<{ id: string; label: string; value: string }>
  emptyTitle: string
  onSelect: (id: string) => void
}): React.JSX.Element {
  if (items.length === 0) return <EmptyState title={emptyTitle} />
  return (
    <ol className="space-y-2.5">
      {items.map((item, index) => (
        <li key={item.id}>
          <button
            className="flex w-full items-center justify-between gap-2 text-left hover:text-brand-strong"
            onClick={() => onSelect(item.id)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                {index + 1}
              </span>
              <span className="truncate text-xs text-foreground">{item.label}</span>
            </span>
            <span className="shrink-0 text-xs font-medium text-muted-foreground">{item.value}</span>
          </button>
        </li>
      ))}
    </ol>
  )
}

function VariantChartBlock({
  chartVariantId,
  onSelectVariant,
  rows
}: {
  chartVariantId: string | null
  onSelectVariant: (id: string) => void
  rows: VariantRow[]
}): React.JSX.Element {
  const forecast = useForecastSeries(chartVariantId)
  const selectedRow = rows.find((r) => r.variant_id === chartVariantId)

  if (!chartVariantId) {
    return (
      <EmptyState
        title="Sin datos para graficar"
        description="Ajusta los filtros para elegir una variante."
      />
    )
  }
  if (forecast.isPending) return <LoadingState rows={2} />
  if (forecast.isError) {
    return (
      <ErrorState
        message={forecast.error instanceof Error ? forecast.error.message : String(forecast.error)}
        onRetry={() => void forecast.refetch()}
      />
    )
  }
  return (
    <div className="space-y-3">
      <VariantSelect
        value={chartVariantId}
        rows={rows}
        onChange={onSelectVariant}
        label="Variante del gráfico"
      />
      <HistoryForecastChart
        history={forecast.data.history as SalesPoint[]}
        forecast={forecast.data.forecast as ForecastPoint[]}
        heightClass="h-64"
      />
      {selectedRow && (
        <p className="text-xs text-muted-foreground">
          Variante seleccionada: {selectedRow.model} · {selectedRow.color} · T{selectedRow.size} —
          estado {selectedRow.risk}
        </p>
      )}
    </div>
  )
}

/* ── Selects de filtro compartidos con valores reales del fixture ── */

import { SearchableSelect } from '@/components/shared/SearchableSelect'
import type { FilterAvailability } from '@shared/contracts'

function PeriodSelect({
  value,
  onChange
}: {
  value: Periodo
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <SearchableSelect
      value={value}
      onValueChange={onChange}
      label="Período"
      className="w-56"
      options={(Object.keys(PERIOD_LABELS) as Periodo[]).map((p) => ({
        value: p,
        label: PERIOD_LABELS[p]
      }))}
    />
  )
}

function ModelSelect({
  availability,
  value,
  onChange
}: {
  availability?: FilterAvailability['data']
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <SearchableSelect
      value={value || 'all'}
      onValueChange={onChange}
      label="Modelos"
      className="w-44"
      options={[
        { value: 'all', label: 'Todos los modelos' },
        ...(availability?.models ?? []).map((m) => ({ value: m, label: m }))
      ]}
    />
  )
}

function ColorSelect({
  availability,
  value,
  onChange
}: {
  availability?: FilterAvailability['data']
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <SearchableSelect
      value={value || 'all'}
      onValueChange={onChange}
      label="Colores"
      className="w-40"
      options={[
        { value: 'all', label: 'Todos los colores' },
        ...(availability?.colors ?? []).map((c) => ({ value: c, label: c }))
      ]}
    />
  )
}

function SizeSelect({
  availability,
  value,
  onChange
}: {
  availability?: FilterAvailability['data']
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  return (
    <SearchableSelect
      value={value || 'all'}
      onValueChange={onChange}
      label="Tallas"
      className="w-40"
      options={[
        { value: 'all', label: 'Todas las tallas' },
        ...(availability?.sizes ?? []).map((sz) => ({ value: sz, label: 'Talla ' + sz }))
      ]}
    />
  )
}

function VariantSelect({
  value,
  rows,
  onChange,
  label
}: {
  value: string
  rows: VariantRow[]
  onChange: (v: string) => void
  label: string
}): React.JSX.Element {
  return (
    <SearchableSelect
      value={value}
      onValueChange={onChange}
      label={label}
      className="w-full max-w-md"
      options={rows.map((r) => ({
        value: r.variant_id,
        label: `${r.model} · ${r.color} · T${r.size} — ${r.variant_id}`
      }))}
    />
  )
}
