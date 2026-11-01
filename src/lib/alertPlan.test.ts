import { describe, expect, it } from 'vitest'
import { buildAlertIdempotencyKey, planAlertAttempts, SANDBOX_PROVIDER, toSandboxAttemptRows } from './alertPlan'

describe('alert attempt planning', () => {
  it('plans one attempt per enabled channel and skips disabled ones', () => {
    const planned = planAlertAttempts([
      { id: 'a', name: 'Asha', sms: true, call: true },
      { id: 'b', name: 'Ravi', sms: true, call: false },
      { id: 'c', name: 'Meena', sms: false, call: false },
    ])
    expect(planned).toEqual([
      { contactId: 'a', contactName: 'Asha', channel: 'sms' },
      { contactId: 'a', contactName: 'Asha', channel: 'call' },
      { contactId: 'b', contactName: 'Ravi', channel: 'sms' },
    ])
  })

  it('returns no attempts when there are no contacts', () => {
    expect(planAlertAttempts([])).toEqual([])
  })
})

describe('sandbox attempt rows', () => {
  it('marks every attempt as simulated on the test sandbox provider', () => {
    const rows = toSandboxAttemptRows('event-1', 'user-1', planAlertAttempts([{ id: 'a', name: 'Asha', sms: true, call: true }]))
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.status).toBe('simulated')
      expect(row.provider).toBe(SANDBOX_PROVIDER)
      expect(row.event_id).toBe('event-1')
      expect(row.user_id).toBe('user-1')
    }
  })
})

describe('alert idempotency key', () => {
  it('is stable for the same alarm start and type', () => {
    expect(buildAlertIdempotencyKey(1700000000000, 'fall')).toBe(buildAlertIdempotencyKey(1700000000000, 'fall'))
  })

  it('differs when the alarm start or type differs', () => {
    expect(buildAlertIdempotencyKey(1700000000000, 'fall')).not.toBe(buildAlertIdempotencyKey(1700000000001, 'fall'))
    expect(buildAlertIdempotencyKey(1700000000000, 'fall')).not.toBe(buildAlertIdempotencyKey(1700000000000, 'sos'))
  })
})
