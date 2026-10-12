import { createFileRoute, Link } from '@tanstack/react-router'
import { Battery, Bluetooth, FlaskConical, ShieldCheck } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { VitalCard } from '@/components/VitalCard'
import { LocationCard } from '@/components/LocationCard'
import { MotionCard } from '@/components/MotionCard'
import { SosButton } from '@/components/SosButton'
import { DEMO_DEVICE, PATIENT, SCENARIOS } from '@/lib/fixtures'
import { VITAL_META, classify, isStale } from '@/lib/detection'
import { set } from '@/lib/store'
import type { VitalKey } from '@/lib/types'

export const Route = createFileRoute('/monitor')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Monitor · Lifeline' }] }),
  component: Monitor,
})

const KEYS: VitalKey[] = ['bp', 'glucose', 'hr', 'spo2']

function Monitor() {
  const demo = useApp((s) => s.demoMode)
  const scenario = useApp((s) => s.scenario)
  const vitals = useApp((s) => s.vitals)
  const thresholds = useApp((s) => s.thresholds)
  const log = useApp((s) => s.log)
  const now = useNow()

  const statuses = KEYS.map((k) => ({ k, s: isStale(k, vitals[k], now) ? 'unknown' : classify(k, vitals[k], thresholds[k]) }))
  const crit = statuses.filter((x) => x.s === 'critical')
  const warn = statuses.filter((x) => x.s === 'warning')
  const anyData = statuses.some((x) => x.s !== 'unknown')

  const headline = !anyData
    ? { t: 'No device connected', d: 'Connect a Bluetooth health device, or switch on demo mode to try Lifeline.', c: 'text-slate-900' }
    : crit.length
      ? { t: `${VITAL_META[crit[0].k].label} critical`, d: 'Alarm triggers after 3 s sustained beyond your limit.', c: 'text-rose-600' }
      : warn.length
        ? { t: `Watching ${VITAL_META[warn[0].k].label.toLowerCase()}`, d: 'Close to your limit. No alarm yet.', c: 'text-amber-700' }
        : { t: 'All vitals stable', d: 'Readings every second. Alarm after 3 s sustained critical value or any fall / jolt.', c: 'text-slate-900' }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-32 pt-6">
      {demo && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-amber-100 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-300">
          <FlaskConical className="size-4.5 shrink-0" />
          <p className="mr-auto"><b>DEMO MODE: no real alerts.</b> Readings are simulated. Automatic alarms won't contact anyone — the SOS button always works for real.</p>
          <button onClick={() => set({ demoMode: false, scenario: 'stable' })} className="rounded-full bg-amber-950 px-3 py-1.5 text-xs font-bold text-amber-50">Use real devices</button>
        </div>
      )}

      {/* Patient + devices */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{PATIENT.name}</span>
        {demo ? (
          <span className="flex items-center gap-1.5"><Bluetooth className="size-4 text-sky-500" />{DEMO_DEVICE.name} · <Battery className="size-4" />{DEMO_DEVICE.battery}%</span>
        ) : (
          <span className="flex items-center gap-1.5"><Bluetooth className="size-4" />No device paired · Bluetooth pairing arrives next release</span>
        )}
        {!demo && (
          <button onClick={() => set({ demoMode: true })} className="ml-auto rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-slate-300 hover:bg-white">Try demo mode</button>
        )}
      </div>

      {/* Headline + SOS */}
      <section className="mt-4 flex items-center gap-6 rounded-[2rem] bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
        <div className="mr-auto">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400"><ShieldCheck className="size-4" /> Status</p>
          <h1 className={`mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-5xl ${headline.c}`}>{headline.t}</h1>
          <p className="mt-2 max-w-xl text-slate-500">{headline.d}</p>
        </div>
        <SosButton />
      </section>

      {/* Vitals */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KEYS.map((k, i) => <VitalCard key={k} k={k} delay={i * 70} />)}
      </section>

      {demo && (
        <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-600">Simulate a reading</h2>
          <p className="text-xs text-slate-500">Push the demo feed into danger zones to see detection, the alarm and the first-aid assistant.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.key}
                onClick={() => set({ scenario: sc.key })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${scenario === sc.key ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
              >
                {sc.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <LocationCard />
        <MotionCard />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <article className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
          <h2 className="text-sm font-semibold text-slate-300">Medical profile</h2>
          <p className="mt-1 text-xs text-slate-400">Shared with contacts and responders in an emergency.</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-slate-400">Blood type</dt><dd className="font-mono text-2xl font-bold">{PATIENT.bloodType}</dd></div>
            <div><dt className="text-xs text-slate-400">Age</dt><dd className="font-mono text-2xl font-bold">{PATIENT.age}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-slate-400">Conditions</dt><dd>{PATIENT.conditions.join(' · ')}</dd></div>
            <div><dt className="text-xs text-slate-400">Allergies</dt><dd className="text-rose-300">{PATIENT.allergies.join(' · ')}</dd></div>
            <div><dt className="text-xs text-slate-400">Medications</dt><dd>{PATIENT.medications.join(' · ')}</dd></div>
          </dl>
          <Link to="/contacts" className="mt-5 inline-block text-xs font-semibold text-sky-300 hover:underline">Emergency contacts →</Link>
        </article>
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="text-sm font-semibold text-slate-600">Activity log</h2>
          <ul className="mt-3 max-h-72 divide-y divide-slate-100 overflow-y-auto">
            {log.map((l) => (
              <li key={l.id} className="flex gap-3 py-2.5 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${l.kind === 'alarm' || l.kind === 'sos' ? 'bg-rose-500' : l.kind === 'cancel' ? 'bg-amber-500' : l.kind === 'location' ? 'bg-sky-500' : 'bg-slate-300'}`} />
                <span className="mr-auto text-slate-700">{l.text}</span>
                <time className="shrink-0 text-xs text-slate-400">{formatWhen(l.at, now)}</time>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  )
}

function formatWhen(t: number, now: number) {
  const d = new Date(t)
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (now - t < 86_400_000 && new Date(now).getDate() === d.getDate()) return time
  return `${d.toLocaleDateString([], { weekday: 'short' })}, ${time}`
}
