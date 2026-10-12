import { useEffect } from 'react'
import { appStore, loadSettings, raiseAlarm, set } from '@/lib/store'
import { DEMO_DEVICE, SCENARIO_TARGETS } from '@/lib/fixtures'
import { VITAL_META, classify, createSustainTracker, formatReading } from '@/lib/detection'
import type { Reading, VitalKey, VitalStatus } from '@/lib/types'

const RING = 60
const drift = (cur: number | undefined, target: number, noise: number) => {
  const base = cur ?? target
  return base + (target - base) * 0.35 + (Math.random() - 0.5) * noise
}

/**
 * Headless engine mounted once in the root layout: feeds readings (demo
 * simulator for now; Bluetooth adapters in a later milestone), classifies
 * them and raises alarms after the sustained-critical window.
 */
export function VitalsEngine() {
  useEffect(() => {
    loadSettings()
    let sustained = createSustainTracker()
    const statuses: Partial<Record<VitalKey, VitalStatus>> = {}
    let tickNo = 0

    const id = setInterval(() => {
      const s = appStore.state
      if (!s.demoMode) {
        if (Object.keys(s.vitals).length) set({ vitals: {}, history: { bp: [], glucose: [], hr: [], spo2: [] } })
        return
      }
      tickNo++
      if (s.scenario === 'fall') {
        raiseAlarm({ type: 'fall', label: 'Fall detected', reading: 'impact then no movement' }, { demo: true })
        set({ scenario: 'stable' })
        return
      }
      const t = SCENARIO_TARGETS[s.scenario as keyof typeof SCENARIO_TARGETS] ?? SCENARIO_TARGETS.stable
      const now = Date.now()
      const mk = (value: number, unit: string, value2?: number): Reading => ({
        value, value2, unit, source: DEMO_DEVICE.name, measuredAt: now, receivedAt: now, quality: 'good',
      })
      const v = { ...s.vitals }
      v.hr = mk(Math.round(drift(v.hr?.value, t.hr, 3)), 'bpm')
      v.spo2 = mk(Math.min(100, Math.round(drift(v.spo2?.value, t.spo2, 1))), '%')
      // Cuff and glucometer are intermittent: new readings every 5 s in demo.
      if (!v.bp || tickNo % 5 === 0 || s.scenario !== 'stable') {
        v.bp = mk(Math.round(drift(v.bp?.value, t.sys, 4)), 'mmHg', Math.round(drift(v.bp?.value2, t.dia, 3)))
      }
      if (!v.glucose || tickNo % 5 === 0 || s.scenario !== 'stable') {
        v.glucose = mk(Math.round(drift(v.glucose?.value, t.glucose, 4)), 'mg/dL')
      }
      const history = { ...s.history }
      for (const k of Object.keys(history) as VitalKey[]) history[k] = [...history[k], v[k]!.value].slice(-RING)
      set({ vitals: v, history })

      for (const k of Object.keys(VITAL_META) as VitalKey[]) statuses[k] = classify(k, v[k], s.thresholds[k], statuses[k])
      // While an alarm is active (or just cancelled) the sustain window restarts from zero.
      if (s.alarm.phase !== 'idle') {
        sustained = createSustainTracker()
        return
      }
      const fired = sustained(statuses)
      if (fired.length) {
        const k = fired[0]
        raiseAlarm(
          { type: 'vital', vital: k, label: `${VITAL_META[k].label} critical`, reading: `${formatReading(k, v[k]!)} ${v[k]!.unit}` },
          { demo: true },
        )
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])
  return null
}
