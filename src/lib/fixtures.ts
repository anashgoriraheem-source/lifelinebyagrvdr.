/**
 * Region-specific emergency reference data and contact form choices.
 */
import type { EmergencyNumbers } from './types'

/**
 * Emergency numbers by country. India's 112 (ERSS) dispatches police, ambulance and
 * fire, and officially accepts call, SMS and app requests (PIB, Dec 2019).
 * smsVerified is true ONLY where emergency SMS is officially supported across the
 * region. Everywhere else the SMS option is hidden and calling is recommended.
 */
export const EMERGENCY_BY_COUNTRY: Record<string, EmergencyNumbers> = {
  IN: { country: 'India', general: '112', police: '100', ambulance: '108', fire: '101', smsNumber: '112', smsVerified: true, smsNote: '112 (ERSS) officially accepts SMS. If you get no reply, call 112.' },
  US: { country: 'United States', general: '911', police: '911', ambulance: '911', fire: '911', smsNumber: '911', smsVerified: false, smsNote: 'Text-to-911 exists only in some areas. Calling 911 is the reliable option.' },
  GB: { country: 'United Kingdom', general: '999', police: '999', ambulance: '999', fire: '999', smsNumber: '999', smsVerified: false, smsNote: 'Texting 999 requires prior registration with emergencySMS (text "register" to 999). Calling is recommended.' },
  EU: { country: 'European Union', general: '112', police: '112', ambulance: '112', fire: '112', smsNumber: '112', smsVerified: false, smsNote: 'Emergency SMS to 112 varies by member state. Calling is recommended.' },
  AU: { country: 'Australia', general: '000', police: '000', ambulance: '000', fire: '000', smsNumber: '000', smsVerified: false, smsNote: 'Texting 000 is not supported; 106 is a relay service for registered users. Calling is recommended.' },
}

export const RELATIONSHIPS = ['Spouse', 'Daughter', 'Son', 'Parent', 'Sibling', 'Friend', 'Neighbour', 'Doctor', 'Caregiver', 'Other']
