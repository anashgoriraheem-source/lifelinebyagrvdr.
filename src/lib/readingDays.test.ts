import { describe, expect, it } from 'vitest'
import { dayKey, mergeDay, parseReadingDays, weekOf } from './readingDays'

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    const midday = new Date(2026, 10, 2, 12, 0, 0)
    expect(dayKey(midday)).toBe('2026-11-02')
  })
})

describe('weekOf', () => {
  it('returns Monday to Sunday for the week holding today', () => {
    const week = weekOf(new Date(2026, 10, 2, 9)) // Monday 2 Nov 2026
    expect(week.map((d) => d.short)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(week[0].date).toBe('2026-11-02')
    expect(week[6].date).toBe('2026-11-08')
  })

  it('keeps Sunday in the week that started on Monday', () => {
    const week = weekOf(new Date(2026, 10, 8, 23)) // Sunday 8 Nov 2026
    expect(week[0].date).toBe('2026-11-02')
    expect(week[6].date).toBe('2026-11-08')
  })
})

describe('mergeDay', () => {
  it('deduplicates vitals recorded on the same day', () => {
    const at = new Date(2026, 10, 2, 10).getTime()
    const once = mergeDay({}, ['hr', 'spo2'], at)
    const twice = mergeDay(once, ['hr'], at)
    expect(twice).toBe(once)
    expect(mergeDay(once, ['bp'], at)['2026-11-02']).toEqual(['hr', 'spo2', 'bp'])
  })

  it('drops days outside the kept window', () => {
    const at = new Date(2026, 10, 2, 10).getTime()
    const next = mergeDay({ '2026-09-01': ['hr'] }, ['hr'], at)
    expect(next['2026-09-01']).toBeUndefined()
    expect(next['2026-11-02']).toEqual(['hr'])
  })
})

describe('parseReadingDays', () => {
  it('ignores malformed storage', () => {
    expect(parseReadingDays(null)).toEqual({})
    expect(parseReadingDays({ nope: ['hr'], '2026-11-02': ['hr', 'bogus'] })).toEqual({ '2026-11-02': ['hr'] })
  })
})
