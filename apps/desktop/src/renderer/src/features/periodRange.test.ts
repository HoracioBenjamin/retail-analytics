import { describe, expect, it } from 'vitest'
import { buildWeeklyTrendRanges, PERIOD_LABELS } from './periodRange'

describe('buildWeeklyTrendRanges', () => {
  it('creates contiguous weekly windows ending at the dataset cutoff', () => {
    const ranges = buildWeeklyTrendRanges('4', '2026-09-01', '2026-10-31')

    expect(ranges).toHaveLength(4)
    expect(ranges[0].date_from).toBe('2026-10-04')
    expect(ranges.at(-1)?.date_to).toBe('2026-10-31')
    expect(ranges[1].date_from).toBe('2026-10-11')
  })

  it('caps all-history trends at the latest 12 weeks and available history', () => {
    const ranges = buildWeeklyTrendRanges('all', '2026-10-20', '2026-10-31')

    expect(ranges).toHaveLength(2)
    expect(ranges[0].date_from).toBe('2026-10-20')
    expect(ranges.at(-1)?.date_to).toBe('2026-10-31')
  })

  it('names the complete historical period as available history', () => {
    expect(PERIOD_LABELS.all).toBe('Todo el histórico disponible')
  })

  it('returns no chart windows before the historical range is known', () => {
    expect(buildWeeklyTrendRanges('12', null, '2026-10-31')).toEqual([])
  })
})
