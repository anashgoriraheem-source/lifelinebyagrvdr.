import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'
import { type AlertHistoryEvent, planAlertAttempts, toSandboxAttemptRows } from './alertPlan'

const recordAlarmInput = z.object({
  idempotencyKey: z.string().min(1).max(200),
  reasonType: z.enum(['vital', 'fall', 'jolt', 'sos']),
  reasonLabel: z.string().trim().min(1).max(200),
  reasonReading: z.string().max(300),
  isDemo: z.boolean(),
  startedAt: z.number().int().positive(),
})

/** Records an alarm in test mode. Re-sending the same alarm returns the existing event and never duplicates attempts. */
export const recordAlarmEvent = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => recordAlarmInput.parse(data))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context
    const contacts = await supabase.from('contacts').select('id, name, sms, call').eq('user_id', userId).order('position')
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
      const existing = await supabase.from('alert_events').select('id').eq('idempotency_key', data.idempotencyKey).maybeSingle()
      if (existing.error || !existing.data) throw new Error('This alarm could not be recorded in your account.')
      eventId = existing.data.id
    }

    const rows = toSandboxAttemptRows(eventId, userId, planAlertAttempts(contacts.data))
    if (rows.length > 0) {
      const attempts = await supabase.from('alert_attempts').upsert(rows, { onConflict: 'event_id,contact_id,channel', ignoreDuplicates: true })
      if (attempts.error) throw new Error('Test attempts could not be recorded for this alarm.')
    }
    return { ok: true as const, eventId }
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
    const attempts = await supabase.from('alert_attempts').select('event_id, channel, contact_name, status, provider').in('event_id', eventIds).order('created_at')
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
