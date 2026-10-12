import { Store } from '@tanstack/react-store'
import { DEFAULT_CONTACTS, DEFAULT_THRESHOLDS, EMERGENCY_BY_COUNTRY, SEED_LOG } from './fixtures'
import type {
  AlarmReason, AlarmState, Contact, LocationFix, LocationStatus, LogEntry, Reading, Threshold, VitalKey,
} from './types'

export interface AppState {
  demoMode: boolean
  scenario: string
  vitals: Partial<Record<VitalKey, Reading>>
  history: Record<VitalKey, number[]>
  thresholds: Record<VitalKey, Threshold>
  contacts: Contact[]
  countryCode: string
  countdownSeconds: number
  alarm: AlarmState
  log: LogEntry[]
  location: { status: LocationStatus; fix: LocationFix | null; error: string | null }
  assistantOpen: boolean
}

const SETTINGS_KEY = 'lifeline:settings:v1'

const initial: AppState = {
  demoMode: true,
  scenario: 'stable',
  vitals: {},
  history: { bp: [], glucose: [], hr: [], spo2: [] },
  thresholds: DEFAULT_THRESHOLDS,
  contacts: DEFAULT_CONTACTS,
  countryCode: 'IN',
  countdownSeconds: 15,
  alarm: { phase: 'idle', reason: null, startedAt: null, demo: false },
  log: SEED_LOG,
  location: { status: 'idle', fix: null, error: null },
  assistantOpen: false,
}

export const appStore = new Store<AppState>(initial)

export const set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) =>
  appStore.setState((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }))

export const emergencyNumbers = (s: AppState) => EMERGENCY_BY_COUNTRY[s.countryCode] ?? EMERGENCY_BY_COUNTRY.IN

let logSeq = 0
export function addLog(kind: LogEntry['kind'], text: string) {
  set((s) => ({ log: [{ id: `e${Date.now()}-${logSeq++}`, at: Date.now(), kind, text }, ...s.log].slice(0, 50) }))
}

/** Start the alarm countdown. De-duplicates: an active alarm is never restarted. */
export function raiseAlarm(reason: AlarmReason, opts: { demo: boolean; immediate?: boolean }) {
  const s = appStore.state
  if (s.alarm.phase !== 'idle') return
  const immediate = opts.immediate || s.countdownSeconds === 0
  set({
    alarm: { phase: immediate ? 'dispatched' : 'countdown', reason, startedAt: Date.now(), demo: opts.demo },
    // Never cover the "I'm OK" button during the countdown.
    assistantOpen: immediate,
  })
  addLog(reason.type === 'sos' ? 'sos' : 'alarm', `${reason.label} · ${reason.reading}${opts.demo ? ' (demo)' : ''}`)
}

export function dispatchAlarm() {
  set((s) => ({ alarm: { ...s.alarm, phase: 'dispatched' }, assistantOpen: true }))
}

export function cancelAlarm(note: string) {
  const s = appStore.state
  if (s.alarm.phase === 'idle') return
  const secs = s.alarm.startedAt ? Math.round((Date.now() - s.alarm.startedAt) / 1000) : 0
  addLog('cancel', `${s.alarm.reason?.label ?? 'Alarm'} · ${note} after ${secs} s`)
  set({ alarm: { phase: 'idle', reason: null, startedAt: null, demo: false } })
  if (s.demoMode && s.scenario !== 'stable') set({ scenario: 'stable' })
}

/* ---- settings persistence (device-local until accounts land, see PLAN.md) ---- */

type Persisted = Pick<AppState, 'contacts' | 'countryCode' | 'countdownSeconds' | 'thresholds' | 'demoMode'>

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) set(JSON.parse(raw) as Partial<Persisted>)
  } catch {
    /* ignore corrupt settings */
  }
  appStore.subscribe((s) => {
    const p: Persisted = {
      contacts: s.contacts, countryCode: s.countryCode, countdownSeconds: s.countdownSeconds,
      thresholds: s.thresholds, demoMode: s.demoMode,
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(p))
  })
}
