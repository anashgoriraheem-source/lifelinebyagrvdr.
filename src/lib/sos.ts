/**
 * Builds the emergency message and the one-tap links that hand it to the
 * phone's own dialer and messaging apps. Nothing is sent silently: the
 * person confirms in their messaging app. Server-side SMS/voice via
 * Twilio arrives in a later milestone (see PLAN.md).
 */
import type { AlarmReason, LocationFix } from './types'
import { appStore } from './store'

export const mapsLink = (f: LocationFix) => `https://maps.google.com/?q=${f.lat.toFixed(6)},${f.lng.toFixed(6)}`

export const clockTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

/** A location older than this must not be presented as current in a message. */
export const STALE_FIX_MS = 120_000

/**
 * Location and medical details are included only with the user's explicit consent.
 * The person reviews and sends the message from their own messaging app.
 */
export function buildSosMessage(reason: AlarmReason | null, fix: LocationFix | null, opts: { test?: boolean } = {}) {
  const { profile: p, consents } = appStore.state
  const name = p.name.trim() || 'A Lifeline user'
  const identity = [p.age !== null ? `age ${p.age}` : null, consents.shareMedical && p.bloodType ? `blood ${p.bloodType}` : null].filter(Boolean).join(', ')
  const fixAge = fix ? Date.now() - fix.at : 0
  const locationLine = !consents.shareLocation
    ? 'Location: not shared — please call to confirm where I am.'
    : fix
      ? fixAge > STALE_FIX_MS
        ? `Location: ${mapsLink(fix)} (OUT OF DATE — measured ${Math.max(1, Math.round(fixAge / 60_000))} min ago, ±${Math.round(fix.accuracy)} m; confirm your location by phone)`
        : `Location: ${mapsLink(fix)} (±${Math.round(fix.accuracy)} m, ${clockTime(fix.at)})`
      : 'Location: unavailable — please call.'
  const list = (items: string[]) => items.join(', ') || 'none listed'
  const lines = [
    `${opts.test ? '[TEST — no action needed] ' : ''}EMERGENCY: ${name}${identity ? ` (${identity})` : ''} needs help.`,
    reason ? `Reason: ${reason.label} — ${reason.reading} at ${clockTime(Date.now())}.` : 'Reason: SOS pressed.',
    locationLine,
    consents.shareMedical ? `Conditions: ${list(p.conditions)}. Allergies: ${list(p.allergies)}. Meds: ${list(p.medications)}.` : null,
    'Sent via Lifeline.',
  ]
  return lines.filter(Boolean).join('\n')
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, '')

const isApple = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)

export function smsHref(phones: string[], body: string) {
  const to = phones.map(digits).join(',')
  return `sms:${to}${isApple() ? '&' : '?'}body=${encodeURIComponent(body)}`
}

export const telHref = (phone: string) => `tel:${digits(phone)}`

/** Dial codes and expected national digit counts for countries we list. */
const COUNTRY_DIAL: Record<string, { dial: string; national: number[] }> = {
  IN: { dial: '91', national: [10] },
  US: { dial: '1', national: [10] },
  GB: { dial: '44', national: [10] },
  AU: { dial: '61', national: [9] },
}

/** Country-aware phone validation. Unknown countries fall back to a generic 3–15 digit check. */
export function isValidPhone(phone: string, countryCode?: string) {
  const raw = digits(phone).replace(/^\+/, '')
  if (!/^\d{3,15}$/.test(raw)) return false
  const c = countryCode ? COUNTRY_DIAL[countryCode] : undefined
  if (!c) return true
  if (raw.startsWith(c.dial)) return c.national.includes(raw.length - c.dial.length)
  return c.national.includes(raw.length)
}
