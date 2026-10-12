/**
 * Fall & jolt detection from the phone accelerometer (m/s², gravity included).
 *
 * Algorithm (a small state machine fed one magnitude sample at a time):
 *  1. FREE-FALL: magnitude drops below FREE_FALL (~0.3 g) for at least
 *     FREE_FALL_MIN_MS — the body/phone is briefly weightless.
 *  2. IMPACT: within IMPACT_WINDOW_MS of free-fall, a spike above the
 *     impact threshold (sensitivity-dependent, ~2.5–3.5 g).
 *  3. STILLNESS: for INACTIVITY_MS after impact the signal stays close to
 *     1 g (little movement). Someone who trips and gets straight up moves
 *     a lot, so this check cuts most false positives.
 *  A separate JOLT rule fires on a very large spike (~4–5 g) with no
 *  preceding free-fall, e.g. a vehicle crash or violent knock.
 */
export type Sensitivity = 'low' | 'medium' | 'high'

export type FallEvent =
  | { type: 'impact'; peak: number }
  | { type: 'checking'; remainingMs: number }
  | { type: 'fall'; peak: number }
  | { type: 'jolt'; peak: number }
  | { type: 'recovered' }

const G = 9.81
const FREE_FALL = 0.35 * G
const FREE_FALL_MIN_MS = 80
const IMPACT_WINDOW_MS = 1000
export const INACTIVITY_MS = 10_000
const STILL_TOLERANCE = 0.25 * G
const IMPACT: Record<Sensitivity, number> = { high: 2.3 * G, medium: 2.8 * G, low: 3.4 * G }
const JOLT: Record<Sensitivity, number> = { high: 3.8 * G, medium: 4.4 * G, low: 5.2 * G }

export function createFallDetector(sensitivity: Sensitivity = 'medium', inactivityMs = INACTIVITY_MS) {
  let freeFallStart: number | null = null
  let freeFallEnd: number | null = null
  let impactAt: number | null = null
  let peak = 0
  let movingSamples = 0
  let samples = 0

  return function feed(mag: number, t: number): FallEvent | null {
    // Stage 3: post-impact stillness check.
    if (impactAt != null) {
      samples++
      if (Math.abs(mag - G) > STILL_TOLERANCE) movingSamples++
      const elapsed = t - impactAt
      if (elapsed >= inactivityMs) {
        const still = movingSamples / Math.max(samples, 1) < 0.2
        const p = peak
        impactAt = null
        return still ? { type: 'fall', peak: p } : { type: 'recovered' }
      }
      return { type: 'checking', remainingMs: inactivityMs - elapsed }
    }

    // Stage 1: free-fall.
    if (mag < FREE_FALL) {
      freeFallStart ??= t
      freeFallEnd = t
      return null
    }
    const hadFreeFall =
      freeFallStart != null && freeFallEnd != null && freeFallEnd - freeFallStart >= FREE_FALL_MIN_MS && t - freeFallEnd <= IMPACT_WINDOW_MS
    if (freeFallEnd != null && t - freeFallEnd > IMPACT_WINDOW_MS) freeFallStart = freeFallEnd = null

    // Stage 2: impact after free-fall.
    if (hadFreeFall && mag > IMPACT[sensitivity]) {
      impactAt = t
      peak = mag
      movingSamples = 0
      samples = 0
      freeFallStart = freeFallEnd = null
      return { type: 'impact', peak: mag }
    }

    // Separate violent jolt rule.
    if (mag > JOLT[sensitivity]) return { type: 'jolt', peak: mag }
    return null
  }
}
