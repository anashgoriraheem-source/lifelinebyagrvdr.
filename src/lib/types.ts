export type VitalKey = 'bp' | 'glucose' | 'hr' | 'spo2'
export type Quality = 'good' | 'uncertain' | 'stale'

/**
 * A supported health service the device exposed but could not deliver readings
 * from. A device that simply lacks a service is described by `missing` instead:
 * this is only for "the service is there and still nothing came out".
 */
export interface DeviceIssue {
  key: VitalKey
  reason: 'notifications-failed' | 'characteristic-missing'
}
export type VitalStatus = 'normal' | 'warning' | 'critical' | 'unknown'
export type SourceBadge = 'live' | 'last-measured' | 'not-provided' | 'demo'

/** Every number on screen carries its provenance. */
export interface Reading {
  value: number
  /** Secondary value, e.g. diastolic for blood pressure. */
  value2?: number
  unit: string
  source: string
  measuredAt: number
  receivedAt: number
  quality: Quality
}

export interface Threshold {
  below: number | null
  above: number | null
  /** Optional second-value limit (diastolic above). */
  above2?: number | null
}

export interface Contact {
  id: string
  name: string
  relationship: string
  phone: string
  call: boolean
  sms: boolean
  /** Email address for alert notifications. Never shown to anyone else. */
  email?: string
  emailAlerts?: boolean
  /**
   * When the person explicitly confirmed these details are correct. This is a
   * self-confirmation, not provider verification: Lifeline has no OTP provider
   * configured yet.
   */
  confirmedAt?: number | null
  /** Test destination: never receives a live provider message. */
  testDestination?: boolean
  /**
   * Documented consent from this contact to receive automated Lifeline alerts
   * (SMS and calls). Never implied by saving a phone number.
   */
  automationConsent?: boolean
  /** Epoch ms when that consent was recorded. */
  consentAt?: number | null
  /** How consent was obtained (for example "told me in person"). */
  consentNote?: string
}

export interface EmergencyNumbers {
  country: string
  general: string
  police: string
  ambulance: string
  fire: string
  /** Number that accepts emergency SMS, where the service supports it. */
  smsNumber: string
  /** True only where emergency SMS is officially supported nationwide. Unverified regions must not offer it. */
  smsVerified?: boolean
  /** Why emergency SMS is (or may not be) available in this region. */
  smsNote?: string
}

export interface LogEntry {
  id: string
  at: number
  kind: 'alarm' | 'info' | 'cancel' | 'sos' | 'location' | 'device'
  text: string
}

export type AlarmReason =
  | { type: 'vital'; vital: VitalKey; label: string; reading: string }
  | { type: 'fall'; label: string; reading: string }
  | { type: 'jolt'; label: string; reading: string }
  | { type: 'stillness'; label: string; reading: string }
  | { type: 'sos'; label: string; reading: string }

export interface AlarmState {
  /** 'active' means the action screen is open. Nobody is contacted automatically in any phase. */
  phase: 'idle' | 'countdown' | 'active'
  reason: AlarmReason | null
  startedAt: number | null
  demo: boolean
}

export type LocationStatus = 'idle' | 'requesting' | 'tracking' | 'denied' | 'unavailable' | 'error'

export interface LocationFix {
  lat: number
  lng: number
  accuracy: number
  at: number
}

export interface Profile {
  name: string
  age: number | null
  bloodType: string
  conditions: string[]
  allergies: string[]
  medications: string[]
}
