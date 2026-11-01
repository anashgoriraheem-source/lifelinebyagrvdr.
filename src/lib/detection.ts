/**
 * Emergency detection — pure functions, no UI dependencies.
 *
 * Status per vital: normal / warning / critical. Warning sits in a band
 * just inside the critical limit. A vital must stay critical for
 * SUSTAIN_MS before an alarm is raised, so one noisy sample never calls
 * anyone. Hysteresis: once critical, a value must come back past the
 * limit by HYSTERESIS before the vital returns to warning.
 */
import type { Reading, Threshold, VitalKey, VitalStatus } from './types'

export const SUSTAIN_MS = 3000
export const MAX_AGE_MS: Record<VitalKey, number> = { hr: 10_000, spo2: 10_000, bp: 30 * 60_000, glucose: 30 * 60_000 }

const WARN_MARGIN: Record<VitalKey, number> = { hr: 15, spo2: 4, bp: 20, glucose: 25 }
const HYSTERESIS: Record<VitalKey, number> = { hr: 5, spo2: 2, bp: 5, glucose: 8 }

export function isStale(key: VitalKey, r: Reading | undefined, now = Date.now()) {
  return !r || now - r.measuredAt > MAX_AGE_MS[key]
}

function beyond(v: number, t: Threshold, margin = 0) {
  return (t.below != null && v < t.below + margin) || (t.above != null && v > t.above - margin)
}

export function classify(key: VitalKey, r: Reading | undefined, t: Threshold, prev: VitalStatus = 'normal'): VitalStatus {
  // Uncertain or stale readings are never treated as reliable enough to alarm on.
  if (!r || r.quality !== 'good') return 'unknown'
  const crit =
    beyond(r.value, t) || (key === 'bp' && t.above2 != null && r.value2 != null && r.value2 > t.above2)
  if (crit) return 'critical'
  if (prev === 'critical') {
    // Hysteresis: stay critical until clearly back inside the limit.
    const h = HYSTERESIS[key]
    const stillNear =
      (t.below != null && r.value < t.below + h) || (t.above != null && r.value > t.above - h)
    if (stillNear) return 'critical'
  }
  return beyond(r.value, t, WARN_MARGIN[key]) ? 'warning' : 'normal'
}

/** Tracks how long each vital has been critical; returns vitals that crossed the sustain window. */
export function createSustainTracker(sustainMs = SUSTAIN_MS) {
  const since: Partial<Record<VitalKey, number>> = {}
  return (statuses: Partial<Record<VitalKey, VitalStatus>>, now = Date.now()): VitalKey[] => {
    const fired: VitalKey[] = []
    for (const k of Object.keys(statuses) as VitalKey[]) {
      if (statuses[k] === 'critical') {
        since[k] ??= now
        if (now - since[k]! >= sustainMs) fired.push(k)
      } else {
        delete since[k]
      }
    }
    return fired
  }
}

export const VITAL_META: Record<VitalKey, { label: string; unit: string; guide: string }> = {
  bp: { label: 'Blood pressure', unit: 'mmHg', guide: 'high-bp' },
  glucose: { label: 'Blood sugar', unit: 'mg/dL', guide: 'low-sugar' },
  hr: { label: 'Heart rate', unit: 'bpm', guide: 'heart-racing' },
  spo2: { label: 'Oxygen', unit: '% SpO₂', guide: 'breathing' },
}

export function formatReading(key: VitalKey, r: Reading) {
  return key === 'bp' ? `${Math.round(r.value)}/${Math.round(r.value2 ?? 0)}` : `${Math.round(r.value)}`
}

/** Which first-aid guide fits a critical vital, given its direction. */
export function guideFor(key: VitalKey, r: Reading, t: Threshold) {
  const low = t.below != null && r.value < t.below
  if (key === 'glucose') return low ? 'low-sugar' : 'high-sugar'
  if (key === 'bp') return low ? 'fainting' : 'high-bp'
  if (key === 'hr') return low ? 'fainting' : 'heart-racing'
  return 'breathing'
}

/**
 * Guardrails for user-editable thresholds: rejects impossible, contradictory
 * or out-of-physiological-range limits before they are saved.
 */
const THRESHOLD_BOUNDS: Record<VitalKey, { below?: [number, number]; above?: [number, number]; above2?: [number, number] }> = {
  bp: { below: [40, 110], above: [70, 260], above2: [30, 160] },
  glucose: { below: [20, 90], above: [70, 500] },
  hr: { below: [20, 80], above: [90, 240] },
  spo2: { below: [60, 98] },
}

export function thresholdError(key: VitalKey, t: Threshold): string | null {
  const b = THRESHOLD_BOUNDS[key]
  const out = (v: number | null, r?: [number, number]) => v != null && r != null && (v < r[0] || v > r[1])
  if (out(t.below, b.below)) return `Lower limit must be between ${b.below![0]} and ${b.below![1]} ${VITAL_META[key].unit}`
  if (out(t.above, b.above)) return `Upper limit must be between ${b.above![0]} and ${b.above![1]} ${VITAL_META[key].unit}`
  if (out(t.above2 ?? null, b.above2)) return `Diastolic limit must be between ${b.above2![0]} and ${b.above2![1]} ${VITAL_META[key].unit}`
  if (t.below != null && t.above != null && t.below >= t.above) return 'Lower limit must be below the upper limit'
  if (key === 'bp' && t.above2 != null && t.above != null && t.above2 >= t.above)
    return 'Diastolic (lower number) limit must be below the systolic limit'
  return null
}
