/**
 * Reading activity by day — which of the supported vitals produced at least one
 * reading on a given calendar day. Only the set of vital keys is kept (never the
 * measured values), device-local, so the seven-day overview can be counted
 * without storing health data.
 */
import type { VitalKey } from './types'

const STORAGE_KEY = 'lifeline:reading-days:v1'
/** Older days are pruned; the dashboard only shows the current week. */
const KEEP_DAYS = 21

export const VITAL_KEYS: VitalKey[] = ['bp', 'glucose', 'hr', 'spo2']

export type ReadingDays = Record<string, VitalKey[]>

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar day, `YYYY-MM-DD` (the site's own time zone, never UTC). */
export function dayKey(at: number | Date) {
  const d = at instanceof Date ? at : new Date(at)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Accepts only well-formed entries, so corrupt storage never breaks the page. */
export function parseReadingDays(raw: unknown): ReadingDays {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ReadingDays = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !Array.isArray(value)) continue
    const keys = value.filter((v): v is VitalKey => typeof v === 'string' && (VITAL_KEYS as string[]).includes(v))
    if (keys.length) out[key] = [...new Set(keys)]
  }
  return out
}

export function loadReadingDays(): ReadingDays {
  try {
    return parseReadingDays(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null'))
  } catch {
    return {}
  }
}

export function saveReadingDays(map: ReadingDays) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* The dashboard still works for this session without storage. */
  }
}

/** Adds the vitals seen today to the map, pruning days older than KEEP_DAYS. */
export function mergeDay(map: ReadingDays, keys: VitalKey[], at = Date.now()): ReadingDays {
  if (!keys.length) return map
  const today = dayKey(at)
  const current = map[today] ?? []
  const merged = [...new Set([...current, ...keys])]
  if (merged.length === current.length) return map

  const next: ReadingDays = { ...map, [today]: merged }
  const cutoffDate = new Date(at)
  cutoffDate.setDate(cutoffDate.getDate() - KEEP_DAYS)
  const cutoff = dayKey(cutoffDate)
  for (const key of Object.keys(next)) if (key < cutoff) delete next[key]
  return next
}

export interface WeekDay {
  date: string
  /** Short label under the bar, e.g. `Mon`. */
  short: string
  /** Full name for accessible labels. */
  long: string
}

const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** The Monday → Sunday week that holds `today` (never a rolling seven days). */
export function weekOf(today: Date): WeekDay[] {
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i)
    return { date: dayKey(d), short: SHORT[d.getDay()], long: LONG[d.getDay()] }
  })
}
