/**
 * Stubbed data for the product surface. Everything here is replaced by
 * real persistence (Netlify Database) and real device readings in later
 * milestones — see PLAN.md. Keep all fake data in this one module.
 */
import type { Contact, EmergencyNumbers, LogEntry, Threshold, VitalKey } from './types'

export const PATIENT = {
  name: 'Ravi Sharma',
  age: 58,
  bloodType: 'B+',
  conditions: ['Type 2 diabetes', 'Hypertension'],
  allergies: ['Penicillin'],
  medications: ['Metformin', 'Amlodipine'],
}

export const DEFAULT_CONTACTS: Contact[] = [
  { id: 'c1', name: 'Priya Sharma', relationship: 'Daughter', phone: '+91 98765 43210', call: true, sms: true },
  { id: 'c2', name: 'Arjun Sharma', relationship: 'Son', phone: '+91 91234 56780', call: true, sms: true },
  { id: 'c3', name: 'Dr. Meera Iyer', relationship: 'Doctor', phone: '+91 99887 76655', call: false, sms: true },
]

/** Emergency numbers by country. India's 112 (ERSS) dispatches police, ambulance and fire. */
export const EMERGENCY_BY_COUNTRY: Record<string, EmergencyNumbers> = {
  IN: { country: 'India', general: '112', police: '100', ambulance: '108', fire: '101', smsNumber: '112' },
  US: { country: 'United States', general: '911', police: '911', ambulance: '911', fire: '911', smsNumber: '911' },
  GB: { country: 'United Kingdom', general: '999', police: '999', ambulance: '999', fire: '999', smsNumber: '999' },
  EU: { country: 'European Union', general: '112', police: '112', ambulance: '112', fire: '112', smsNumber: '112' },
  AU: { country: 'Australia', general: '000', police: '000', ambulance: '000', fire: '000', smsNumber: '106' },
}

export const RELATIONSHIPS = ['Spouse', 'Daughter', 'Son', 'Parent', 'Sibling', 'Friend', 'Neighbour', 'Doctor', 'Caregiver', 'Other']

/** Defaults from the spec. Users edit these; always discuss with your doctor. */
export const DEFAULT_THRESHOLDS: Record<VitalKey, Threshold> = {
  bp: { below: 80, above: 180, above2: 120 },
  glucose: { below: 54, above: 320 },
  hr: { below: 40, above: 130 },
  spo2: { below: 88, above: null },
}

const now = Date.now()
const h = 3600_000
export const SEED_LOG: LogEntry[] = [
  { id: 'l1', at: now - 18 * h, kind: 'info', text: 'Glucose dipped to 68 mg/dL · recovered after 12 min' },
  { id: 'l2', at: now - 50 * h, kind: 'info', text: 'Morning BP logged · 138/86 mmHg' },
  { id: 'l3', at: now - 74 * h, kind: 'cancel', text: 'Hard jolt detected · cancelled by wearer within 4 s' },
]

export type ScenarioKey =
  | 'stable' | 'bp-spike' | 'bp-crash' | 'sugar-spike' | 'sugar-crash' | 'heart-racing' | 'low-oxygen' | 'fall'

export const SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: 'stable', label: 'Stable' },
  { key: 'bp-spike', label: 'BP spike' },
  { key: 'bp-crash', label: 'BP crash' },
  { key: 'sugar-spike', label: 'Sugar spike' },
  { key: 'sugar-crash', label: 'Sugar crash' },
  { key: 'heart-racing', label: 'Heart racing' },
  { key: 'low-oxygen', label: 'Low oxygen' },
  { key: 'fall', label: 'Fall' },
]

/** Target values the demo simulator drifts toward for each scenario. */
export const SCENARIO_TARGETS: Record<Exclude<ScenarioKey, 'fall'>, { sys: number; dia: number; glucose: number; hr: number; spo2: number }> = {
  stable: { sys: 124, dia: 80, glucose: 112, hr: 74, spo2: 97 },
  'bp-spike': { sys: 196, dia: 124, glucose: 118, hr: 92, spo2: 96 },
  'bp-crash': { sys: 72, dia: 44, glucose: 110, hr: 112, spo2: 95 },
  'sugar-spike': { sys: 132, dia: 84, glucose: 348, hr: 88, spo2: 97 },
  'sugar-crash': { sys: 118, dia: 76, glucose: 46, hr: 104, spo2: 97 },
  'heart-racing': { sys: 142, dia: 90, glucose: 120, hr: 148, spo2: 96 },
  'low-oxygen': { sys: 128, dia: 82, glucose: 114, hr: 108, spo2: 84 },
}

export const DEMO_DEVICE = { name: 'Demo band', battery: 82 }
