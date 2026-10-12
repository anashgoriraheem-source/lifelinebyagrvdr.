/**
 * Lifeline assistant — on-device intent engine. Works offline, which matters
 * in an emergency. A Claude-backed conversational layer is added in a later
 * milestone (PLAN.md); it must keep these same safety rules:
 * not a doctor, no diagnoses, no dose changes, never discourage emergency care.
 */
import { GUIDES, guideById, matchGuide, type Guide } from './firstAid'
import { VITAL_META, formatReading, guideFor, isStale } from './detection'
import { emergencyNumbers, type AppState } from './store'
import { clockTime, mapsLink } from './sos'
import type { VitalKey } from './types'

export type Action =
  | { kind: 'call'; number: string; label: string }
  | { kind: 'start-sos' }
  | { kind: 'open-guide'; id: string }
  | { kind: 'share-location' }
  | { kind: 'start-location' }

export interface Reply {
  text: string
  guide?: Guide
  actions?: Action[]
}

export const QUICK_CHIPS = ["What's my status?", 'Explain this alert', 'What should I do?', 'Summarise today', 'Where am I?', 'Help me connect my watch']

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))

export function respond(input: string, s: AppState): Reply {
  const q = input.toLowerCase().trim()
  const n = emergencyNumbers(s)
  const callAll: Action[] = [{ kind: 'call', number: n.general, label: `Call ${n.general}` }]
  const inAlarm = s.alarm.phase !== 'idle'
  const prefix = inAlarm ? (s.alarm.demo ? 'Demo alert — nobody is being contacted. ' : 'Help is being contacted. ') : ''

  // 1. Explicit emergency requests.
  if (has(q, 'police')) {
    return {
      text: `${prefix}Police: ${n.police}. All-in-one emergency: ${n.general}. I can also start SOS, which prepares a message with your live location for police, ambulance and your contacts.`,
      actions: [{ kind: 'call', number: n.police, label: `Call police ${n.police}` }, { kind: 'start-sos' }],
    }
  }
  if (has(q, 'ambulance')) {
    return {
      text: `${prefix}Ambulance: ${n.ambulance}. All-in-one emergency: ${n.general}. Say what happened, your location, and whether the person is breathing.`,
      actions: [{ kind: 'call', number: n.ambulance, label: `Call ambulance ${n.ambulance}` }, { kind: 'start-sos' }],
    }
  }
  if (has(q, 'sos', 'emergency', 'call for help', 'send alert', 'need help') || /^help( me)?[.!]*$/.test(q)) {
    return {
      text: `${prefix}Do you want me to start SOS? It sounds the alarm, shares your live location and prepares messages for emergency services and your contacts. If life is at risk, call ${n.general} now.`,
      actions: [{ kind: 'start-sos' }, ...callAll],
    }
  }

  // 2. Location.
  if (has(q, 'where am i', 'location', 'my address', 'share my')) {
    const f = s.location.fix
    if (f) {
      return {
        text: `Your location (±${Math.round(f.accuracy)} m, ${clockTime(f.at)}): ${f.lat.toFixed(5)}, ${f.lng.toFixed(5)}. Map link: ${mapsLink(f)}`,
        actions: [{ kind: 'share-location' }],
      }
    }
    return {
      text: s.location.status === 'denied'
        ? 'Location access is blocked. Enable it for this site in your browser settings so SOS messages can include where you are.'
        : "I don't have your location yet. Turn on location tracking so SOS messages include a live map link.",
      actions: [{ kind: 'start-location' }],
    }
  }

  // 3. Status from real state — never invent numbers.
  if (has(q, 'status', 'how am i', 'my vitals', 'readings')) {
    const parts = (Object.keys(VITAL_META) as VitalKey[]).map((k) => {
      const r = s.vitals[k]
      if (!r) return `${VITAL_META[k].label}: no data from a connected device`
      if (isStale(k, r)) return `${VITAL_META[k].label}: signal lost (last ${clockTime(r.measuredAt)})`
      return `${VITAL_META[k].label} ${formatReading(k, r)} ${r.unit}`
    })
    const src = s.demoMode ? ' These are demo readings, not real measurements.' : ''
    return { text: `${prefix}${parts.join('. ')}.${src}` }
  }

  // 4. Alarm explanation and what to do.
  if (has(q, 'explain', 'why did', 'why alert', 'alert fired')) {
    const last = inAlarm ? s.alarm.reason : null
    if (last) return { text: `The alarm fired because of ${last.label.toLowerCase()}: ${last.reading}. Lifeline alarms when a vital stays beyond your limit for 3 seconds, or on a detected fall, jolt or SOS press.` }
    const lastLog = s.log.find((l) => l.kind === 'alarm' || l.kind === 'sos' || l.kind === 'cancel')
    return { text: lastLog ? `The most recent alert: ${lastLog.text} (${new Date(lastLog.at).toLocaleString()}).` : 'There are no recent alerts.' }
  }
  if (has(q, 'what should i do', 'what do i do', 'what now', 'first aid')) {
    const reason = s.alarm.reason
    let id: string | null = null
    if (reason?.type === 'vital') {
      const r = s.vitals[reason.vital]
      id = r ? guideFor(reason.vital, r, s.thresholds[reason.vital]) : VITAL_META[reason.vital].guide
    } else if (reason?.type === 'fall' || reason?.type === 'jolt') id = 'fall'
    if (id) return guideReply(guideById(id)!, s, prefix)
    return {
      text: `${prefix}Tell me what is happening — for example "chest pain", "choking", "low sugar" or "not breathing" — and I'll guide you step by step. If anyone's life is at risk, call ${n.general} first.`,
      actions: [{ kind: 'open-guide', id: 'cpr' }, { kind: 'open-guide', id: 'chest-pain' }, { kind: 'open-guide', id: 'low-sugar' }, ...callAll],
    }
  }

  if (has(q, 'summar', 'today', 'this week')) {
    const day = Date.now() - 86_400_000
    const today = s.log.filter((l) => l.at > day)
    const alarms = today.filter((l) => l.kind === 'alarm' || l.kind === 'sos').length
    const cancels = today.filter((l) => l.kind === 'cancel').length
    return {
      text: today.length
        ? `In the last 24 hours: ${today.length} events, ${alarms} alarm${alarms === 1 ? '' : 's'}, ${cancels} cancelled. Latest: ${today[0].text}.`
        : 'Nothing logged in the last 24 hours.',
    }
  }

  if (has(q, 'connect', 'watch', 'bluetooth', 'pair', 'device', 'band')) {
    return {
      text: 'Lifeline connects to devices using standard Bluetooth health profiles: heart-rate straps, watches in heart-rate broadcast mode, pulse oximeters, BP cuffs and glucometers. Use Chrome or Edge on Android or desktop; iPhone Safari does not support Web Bluetooth (the native app will). On Garmin, turn on "Broadcast Heart Rate". On Polar and Coros, enable HR sharing. Apple Watch, Galaxy Watch and Fitbit need their cloud or native connection. Device pairing is on the way in the next release.',
    }
  }

  // 5. First-aid guides by keyword.
  const g = matchGuide(q)
  if (g) return guideReply(g, s, prefix)

  if (has(q, 'thank')) return { text: "You're welcome. I'm here if you need me." }
  if (has(q, 'hello', 'hi ', 'hey') || q === 'hi') {
    return { text: 'Hi, I\'m the Lifeline assistant. Ask me for first-aid steps, your status, your location, or say "SOS".' }
  }

  return {
    text: `I can guide you through first aid for: ${GUIDES.slice(0, 8).map((x) => x.title.split(' · ')[0].toLowerCase()).join(', ')} and more. I'm not a doctor and can't diagnose. If something feels seriously wrong, call ${n.general}.`,
    actions: callAll,
  }
}

export function guideReply(g: Guide, s: AppState, prefix = ""): Reply {
  const n = emergencyNumbers(s)
  const callLine = g.call === 'always' ? `Call ${n.general} now. ` : ''
  return {
    text: `${prefix}${callLine}${g.intro}`,
    guide: g,
    actions: [{ kind: 'call', number: n.general, label: `Call ${n.general}` }],
  }
}
