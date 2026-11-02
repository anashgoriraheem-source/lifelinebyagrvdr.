import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import {
  type AlertHistoryEvent, type AutoAlertOutcome, autoAlertGate, planAlertAttempts, toUnavailableAttemptRows,
} from './alertPlan'
import { getAlertProvider, liveAlertsEnabled } from './alertProvider.server'

const recordAlarmInput = z.object({
  idempotencyKey: z.string().min(1).max(200),
  reasonType: z.enum(['vital', 'fall', 'jolt', 'sos']),
  reasonLabel: z.string().trim().min(1).max(200),
  reasonReading: z.string().max(300),
  isDemo: z.boolean(),
  startedAt: z.number().int().positive(),
})

/**
 * Records one durable alarm event per trigger (idempotent on the client key).
 * Automatic contact attempts are planned only for a deliberate, non-demo SOS with
 * the user's consent. With no provider configured they are stored as `unavailable`;
 * nothing is ever reported as sent or delivered without a provider confirming it.
 */
export const recordAlarmEvent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => recordAlarmInput.parse(data))
  .handler(async ({ context, data }): Promise<{ ok: true; eventId: string; autoAlert: AutoAlertOutcome; attempts: number }> => {
    const { supabase, userId } = context
    const [contacts, prefs] = await Promise.all([
      supabase.from('contacts').select('id, name, sms, call').eq('user_id', userId).order('position'),
      supabase.from('safety_preferences').select('contact_alerts_consent').eq('user_id', userId).maybeSingle(),
    ])
    if (contacts.error) throw new Error('Could not read your saved contacts, so this alarm was not recorded.')

    const event = await supabase.from('alert_events').upsert({
      user_id: userId,
      idempotency_key: data.idempotencyKey,
      mode: 'test',
      reason_type: data.reasonType,
      reason_label: data.reasonLabel,
      reason_reading: data.reasonReading,
      is_demo: data.isDemo,
      started_at: new Date(data.startedAt).toISOString(),
    }, { onConflict: 'user_id,idempotency_key', ignoreDuplicates: true }).select('id')
    if (event.error) throw new Error('This alarm could not be recorded in your account.')

    let eventId = event.data[0]?.id
    if (!eventId) {
      const existing = await supabase.from('alert_events').select('id').eq('user_id', userId).eq('idempotency_key', data.idempotencyKey).maybeSingle()
      if (existing.error || !existing.data) throw new Error('This alarm could not be recorded in your account.')
      eventId = existing.data.id
    }

    const planned = planAlertAttempts(contacts.data)
    const gate = autoAlertGate({
      reasonType: data.reasonType,
      isDemo: data.isDemo,
      consent: prefs.data?.contact_alerts_consent === true,
      contactCount: planned.length,
    })
    if (gate !== 'allowed') return { ok: true as const, eventId, autoAlert: gate, attempts: 0 }

    const provider = getAlertProvider()
    const autoAlert: AutoAlertOutcome = !provider ? 'provider-unavailable' : !liveAlertsEnabled() ? 'live-disabled' : 'provider-unavailable'
    const rows = toUnavailableAttemptRows(eventId, userId, planned)
    const attempts = await supabase.from('alert_attempts').upsert(rows, { onConflict: 'event_id,contact_id,channel', ignoreDuplicates: true })
    if (attempts.error) throw new Error('Alert attempts could not be recorded for this alarm.')
    return { ok: true as const, eventId, autoAlert, attempts: rows.length }
  })

export const listAlertHistory = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<{ events: AlertHistoryEvent[] }> => {
  const { supabase, userId } = context
  const events = await supabase
    .from('alert_events')
    .select('id, reason_type, reason_label, reason_reading, is_demo, mode, started_at')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(20)
  if (events.error) throw new Error('Alert history could not be loaded. Try again.')
  const eventIds = events.data.map((e) => e.id)
  const attemptRows: { event_id: string; channel: string; contact_name: string; status: string; provider: string }[] = []
  if (eventIds.length > 0) {
    const attempts = await supabase.from('alert_attempts').select('event_id, channel, contact_name, status, provider').eq('user_id', userId).in('event_id', eventIds).order('created_at')
    if (attempts.error) throw new Error('Alert history could not be loaded. Try again.')
    attemptRows.push(...attempts.data)
  }
  return {
    events: events.data.map((e) => ({
      ...e,
      attempts: attemptRows
        .filter((a) => a.event_id === e.id)
        .map((a) => ({ channel: a.channel, contact_name: a.contact_name, status: a.status, provider: a.provider })),
    })),
  }
})

const preferencesInput = z.object({
  countryCode: z.enum(['IN', 'US', 'GB', 'EU', 'AU']),
  contactAlerts: z.boolean(),
  shareLocation: z.boolean(),
  shareMedical: z.boolean(),
})
export type SafetyPreferences = z.infer<typeof preferencesInput>

export const getSafetyPreferences = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<SafetyPreferences | null> => {
  const { supabase, userId } = context
  const res = await supabase.from('safety_preferences').select('country_code, contact_alerts_consent, share_location_consent, share_medical_consent').eq('user_id', userId).maybeSingle()
  if (res.error) throw new Error('Your alert preferences could not be loaded.')
  if (!res.data) return null
  const parsed = preferencesInput.safeParse({
    countryCode: res.data.country_code,
    contactAlerts: res.data.contact_alerts_consent,
    shareLocation: res.data.share_location_consent,
    shareMedical: res.data.share_medical_consent,
  })
  return parsed.success ? parsed.data : null
})

export const saveSafetyPreferences = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => preferencesInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    const now = new Date().toISOString()
    const res = await supabase.from('safety_preferences').upsert({
      user_id: userId,
      country_code: data.countryCode,
      contact_alerts_consent: data.contactAlerts,
      share_location_consent: data.shareLocation,
      share_medical_consent: data.shareMedical,
      consent_updated_at: now,
      updated_at: now,
    }, { onConflict: 'user_id' })
    if (res.error) throw new Error('Your alert preferences could not be saved.')
    return { ok: true as const }
  })
