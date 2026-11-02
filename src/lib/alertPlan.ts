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
  unavailable: 'Not sent: no alert provider set up',
  queued: 'Queued, not yet sent',
  attempted: 'Send attempted, outcome unconfirmed',
  sent: 'Send attempted, outcome unconfirmed',
  provider_accepted: 'Accepted by provider, delivery unconfirmed',
  delivered: 'Delivery confirmed by provider',
  acknowledged: 'Acknowledged by contact',
  failed: 'Failed',
  unknown: 'Outcome unknown',
}

/** Why automatic contact alerts were or were not planned for an alarm. */
export type AutoAlertOutcome = 'not-sos' | 'demo' | 'no-consent' | 'no-contacts' | 'provider-unavailable' | 'live-disabled'

export const AUTO_ALERT_TEXT: Record<AutoAlertOutcome, string> = {
  'not-sos': 'Automatic contact alerts only follow a deliberate SOS. Nothing was sent.',
  demo: 'Demo alarm: nobody is contacted.',
  'no-consent': 'Automatic contact alerts are off in your account settings. Nothing was sent.',
  'no-contacts': 'No saved contacts can receive alerts. Nothing was sent.',
  'provider-unavailable': 'Automatic alerts are not set up yet (no messaging provider). Nothing was sent. Use the buttons below.',
  'live-disabled': 'Live alert sending is switched off for this deployment. Nothing was sent.',
}

/** Decides whether automatic attempts may be planned. Pure, so it can be unit-tested. */
export function autoAlertGate(input: { reasonType: AlarmReason['type']; isDemo: boolean; consent: boolean; contactCount: number }): AutoAlertOutcome | 'allowed' {
  if (input.isDemo) return 'demo'
  if (input.reasonType !== 'sos') return 'not-sos'
  if (!input.consent) return 'no-consent'
  if (input.contactCount === 0) return 'no-contacts'
  return 'allowed'
}

export function toUnavailableAttemptRows(eventId: string, userId: string, planned: PlannedAttempt[]) {
  return planned.map((p) => ({
    event_id: eventId,
    user_id: userId,
    contact_id: p.contactId,
    contact_name: p.contactName,
    channel: p.channel,
    provider: 'none',
    status: 'unavailable' as const,
    detail: 'No messaging provider is configured.',
  }))
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
