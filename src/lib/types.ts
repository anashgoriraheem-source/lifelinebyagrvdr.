export type VitalKey = 'bp' | 'glucose' | 'hr' | 'spo2'
export type Quality = 'good' | 'uncertain' | 'stale'
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
}

export interface EmergencyNumbers {
  country: string
  general: string
  police: string
  ambulance: string
  fire: string
  /** Number that accepts emergency SMS, where the service supports it. */
  smsNumber: string
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
  | { type: 'sos'; label: string; reading: string }

export interface AlarmState {
  phase: 'idle' | 'countdown' | 'dispatched'
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
