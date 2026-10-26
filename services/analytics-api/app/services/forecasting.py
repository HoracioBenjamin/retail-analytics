"""Baseline estadístico de demanda intermitente Croston-SBA, sin dependencias externas.

No es un modelo ML entrenado; informa una estimación nivelada cuando hay poco
historial y deja la decisión de compra bloqueada hasta contar con datos suficientes.
"""

from __future__ import annotations

from datetime import date, timedelta

from app.schemas.domain import ForecastPoint

FORECAST_HORIZON_WEEKS = 4
MIN_HISTORY_DAYS = 28
EXCESS_THRESHOLD_WEEKS = 8.0
SMOOTHING_ALPHA = 0.2


def croston_sba_weekly(daily_units: list[int]) -> float:
    """Estima unidades por semana para una serie diaria con ventas intermitentes."""
    if not daily_units:
        return 0.0

    nonzero = [(index, units) for index, units in enumerate(daily_units) if units > 0]
    if not nonzero:
        return 0.0
    if len(nonzero) == 1:
        return sum(daily_units) / len(daily_units) * 7

    first_index, first_size = nonzero[0]
    smoothed_size = float(first_size)
    smoothed_interval = float(first_index + 1)
    previous_index = first_index

    for index, units in nonzero[1:]:
        interval = index - previous_index
        smoothed_size += SMOOTHING_ALPHA * (units - smoothed_size)
        smoothed_interval += SMOOTHING_ALPHA * (interval - smoothed_interval)
        previous_index = index

    bias_correction = 1 - SMOOTHING_ALPHA / 2
    return max(0.0, bias_correction * smoothed_size / smoothed_interval * 7)


def forecast_points(
    variant_id: str,
    weekly_units: float,
    as_of: str,
    horizon_weeks: int = FORECAST_HORIZON_WEEKS,
) -> list[ForecastPoint]:
    """Proyecta una demanda semanal constante como baseline explícito."""
    start = date.fromisoformat(as_of) + timedelta(days=1)
    points: list[ForecastPoint] = []
    for offset in range(horizon_weeks):
        period_start = start + timedelta(weeks=offset)
        period_end = period_start + timedelta(days=6)
        points.append(
            ForecastPoint(
                variant_id=variant_id,
                period_start=period_start.isoformat(),
                period_end=period_end.isoformat(),
                predicted_units=round(weekly_units, 2),
                method="baseline",
                model_version=None,
            )
        )
    return points
