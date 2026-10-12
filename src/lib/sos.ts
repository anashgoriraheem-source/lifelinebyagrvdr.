/**
 * Builds the emergency message and the one-tap links that hand it to the
 * phone's own dialer and messaging apps. Nothing is sent silently: the
 * person confirms in their messaging app. Server-side SMS/voice via
 * Twilio arrives in a later milestone (see PLAN.md).
 */
import type { AlarmReason, LocationFix } from './types'
import { PATIENT } from './fixtures'

export const mapsLink = (f: LocationFix) => `https://maps.google.com/?q=${f.lat.toFixed(6)},${f.lng.toFixed(6)}`

export const clockTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export function buildSosMessage(reason: AlarmReason | null, fix: LocationFix | null, opts: { test?: boolean } = {}) {
  const p = PATIENT
  const lines = [
    `${opts.test ? '[TEST — no action needed] ' : ''}EMERGENCY: ${p.name} (${p.age}, blood ${p.bloodType}) needs help.`,
    reason ? `Reason: ${reason.label} — ${reason.reading} at ${clockTime(Date.now())}.` : 'Reason: SOS pressed.',
    fix
      ? `Location: ${mapsLink(fix)} (±${Math.round(fix.accuracy)} m, ${clockTime(fix.at)})`
      : 'Location: unavailable — please call.',
    `Conditions: ${p.conditions.join(', ')}. Allergies: ${p.allergies.join(', ')}. Meds: ${p.medications.join(', ')}.`,
    'Sent via Lifeline.',
  ]
  return lines.join('\n')
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, '')

const isApple = () => typeof navigator !== 'undefined' && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)

export function smsHref(phones: string[], body: string) {
  const to = phones.map(digits).join(',')
  return `sms:${to}${isApple() ? '&' : '?'}body=${encodeURIComponent(body)}`
}

export const telHref = (phone: string) => `tel:${digits(phone)}`

export function isValidPhone(phone: string) {
  const d = digits(phone)
  return /^\+?\d{3,15}$/.test(d)
}
