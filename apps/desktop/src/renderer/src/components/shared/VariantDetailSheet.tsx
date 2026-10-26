import { AlertCircle, Info } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { StatusBadge } from './StatusBadge'
import { HistoryForecastChart } from './HistoryForecastChart'
import { useDatasetMetadata, useVariantDetail } from '@/hooks/api'
import { fmtCLP, fmtCoverage, fmtNum, longDate } from '@/lib/format'

/**
 * Detalle lateral de variante (plan, sección 8: "una variante seleccionada
 * abre siempre el mismo detalle desde una tarjeta, tabla o recomendación").
 * Autosuficiente: recibe el variant_id y consulta el detalle por el puente.
 */
export function VariantDetailSheet({
  variantId,
  onOpenChange
}: {
  variantId: string | null
  onOpenChange: (open: string | null) => void
}): React.JSX.Element {
  const { data, isPending, isError, error, refetch } = useVariantDetail(variantId)
  const conectado = useDatasetMetadata()?.data_mode === 'connected'

  return (
    <Sheet
      open={variantId !== null}
      onOpenChange={(open) => (!open ? onOpenChange(null) : undefined)}
    >
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden sm:max-w-lg">
        {isPending && (
          <div className="p-6 text-sm text-muted-foreground">Cargando detalle de la variante…</div>
        )}
        {isError && (
          <div className="flex flex-col gap-2 p-6">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive">
              <AlertCircle className="size-4" aria-hidden="true" />
              No se pudo cargar el detalle
            </div>
            <p className="font-mono text-xs text-muted-foreground">
              {error instanceof Error ? error.message : String(error)}
            </p>
            <button
              className="self-start text-xs text-brand-strong underline underline-offset-2"
              onClick={() => void refetch()}
            >
              Reintentar
            </button>
          </div>
        )}
        {data && (
          <>
            <SheetHeader className="shrink-0 border-b pb-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <SheetTitle className="text-base">{data.variant.model}</SheetTitle>
                  <SheetDescription className="text-xs">
                    {data.variant.color} · Talla {data.variant.size} {data.variant.size_system} ·{' '}
                    <span className="font-mono">{data.variant.sku}</span>
                  </SheetDescription>
                </div>
                {data.recommendation && <StatusBadge risk={data.recommendation.risk} />}
              </div>
            </SheetHeader>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {/* Indicadores */}
              <div className="grid grid-cols-2 gap-2">
                <DetailStat
                  label="Stock disponible"
                  value={`${fmtNum(data.variant.stock_on_hand)} uds`}
                />
                <DetailStat
                  label="Ventas del histórico"
                  value={`${fmtNum(
                    data.sales_history.reduce((acc, p) => acc + p.units_sold, 0)
                  )} uds`}
                />
                <DetailStat
                  label="Importe del histórico"
                  value={fmtCLP(data.sales_history.reduce((acc, p) => acc + p.sales_amount_clp, 0))}
                  className="col-span-1"
                />
                <DetailStat
                  label="Cobertura estimada"
                  value={fmtCoverage(data.recommendation?.coverage_weeks ?? null)}
                />
              </div>

              {/* Razón de la recomendación */}
              {data.recommendation ? (
                <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Info className="size-3.5" aria-hidden="true" />
                    Razón de la recomendación
                  </div>
                  <p className="text-xs leading-relaxed text-foreground">
                    {data.recommendation.reason}
                  </p>
                  {data.recommendation.parameters && (
                    <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                      Parámetros: plazo proveedor{' '}
                      {fmtNum(data.recommendation.parameters.lead_time_weeks)} sem · revisión{' '}
                      {fmtNum(data.recommendation.parameters.review_period_weeks)} sem · seguridad{' '}
                      {fmtNum(data.recommendation.parameters.safety_stock_weeks)} sem · en camino{' '}
                      {fmtNum(data.recommendation.parameters.units_in_transit)} uds ·{' '}
                      {fmtNum(data.recommendation.parameters.demand_weeks_used)} semanas con
                      disponibilidad usadas para la demanda
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  No hay datos suficientes para generar una recomendación para esta variante.
                </p>
              )}

              {/* Ventas históricas + pronóstico ilustrativo */}
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {conectado
                    ? 'Ventas históricas y baseline Croston-SBA de cuatro semanas'
                    : 'Ventas históricas de 12 semanas y pronóstico de ejemplo'}
                </p>
                <HistoryForecastChart
                  history={data.sales_history}
                  forecast={data.forecast}
                  heightClass="h-44"
                  showAxes={false}
                />
              </div>
            </div>

            <div className="shrink-0 border-t px-5 py-3">
              <p className="text-[10px] text-muted-foreground">
                {data.sales_history.at(-1) && (
                  <>
                    Fuente: {conectado ? 'Supabase' : 'dataset de demostración'} · cierre del
                    histórico: {longDate(data.sales_history.at(-1)!.period_end)}.
                    {conectado
                      ? ' El baseline Croston-SBA es estadístico y no tiene precisión validada.'
                      : ' Los valores futuros son ilustrativos (method «fixture», model_version null).'}
                  </>
                )}
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

function DetailStat({
  label,
  value,
  className
}: {
  label: string
  value: string
  className?: string
}): React.JSX.Element {
  return (
    <div className={`rounded-lg border bg-card p-3 ${className ?? ''}`}>
      <p className="text-[10px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
    </div>
  )
}
