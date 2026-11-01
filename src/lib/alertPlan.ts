import type { AlarmReason } from './types'

export type AlertChannel = 'sms' | 'call'
export type AlertRecordState = 'idle' | 'saving' | 'saved' | 'error' | 'signed-out'

export interface AlertContact {
  id: string
  name: string
  sms: boolean
  call: boolean
}

export interface PlannedAttempt {
  contactId: string
  contactName: string
  channel: AlertChannel
}

export interface AlertHistoryAttempt {
  channel: string
  contact_name: string
  status: string
  provider: string
}

export interface AlertHistoryEvent {
  id: string
  reason_type: string
  reason_label: string
  reason_reading: string
  is_demo: boolean
  mode: string
  started_at: string
  attempts: AlertHistoryAttempt[]
}

export interface SandboxAttemptRow {
  event_id: string
  user_id: string
  contact_id: string
  contact_name: string
  channel: AlertChannel
  provider: string
  status: 'simulated'
}

export const SANDBOX_PROVIDER = 'test-sandbox'

export const CHANNEL_LABEL: Record<AlertChannel, string> = { sms: 'Text message', call: 'Call' }

export const ATTEMPT_STATUS_LABEL: Record<string, string> = {
  simulated: 'Test only, not sent',
  queued: 'Queued',
  sent: 'Sent',
  delivered: 'Delivered',
  failed: 'Failed',
}

export function buildAlertIdempotencyKey(startedAt: number, reasonType: AlarmReason['type']) {
  return `${startedAt}:${reasonType}`
}

export function planAlertAttempts(contacts: AlertContact[]): PlannedAttempt[] {
  return contacts.flatMap((c) => {
    const planned: PlannedAttempt[] = []
    if (c.sms) planned.push({ contactId: c.id, contactName: c.name, channel: 'sms' })
    if (c.call) planned.push({ contactId: c.id, contactName: c.name, channel: 'call' })
    return planned
  })
}

/** Test mode: every planned attempt is recorded as simulated. No provider is contacted. */
export function toSandboxAttemptRows(eventId: string, userId: string, planned: PlannedAttempt[]): SandboxAttemptRow[] {
  return planned.map((p) => ({
    event_id: eventId,
    user_id: userId,
    contact_id: p.contactId,
    contact_name: p.contactName,
    channel: p.channel,
    provider: SANDBOX_PROVIDER,
    status: 'simulated',
  }))
}
