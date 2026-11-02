import { Button } from '@/components/ui/button'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Battery, Bluetooth, FlaskConical, ShieldCheck } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { VitalCard } from '@/components/VitalCard'
import { LocationCard } from '@/components/LocationCard'
import { MotionCard } from '@/components/MotionCard'
import { SosButton } from '@/components/SosButton'
import { DEMO_DEVICE, SCENARIOS } from '@/lib/fixtures'
import { VITAL_META, classify, isStale } from '@/lib/detection'
import { set } from '@/lib/store'
import type { VitalKey } from '@/lib/types'
import { disconnectWearable, pairWearable } from '@/core/ble/connect'

export const Route = createFileRoute('/monitor')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Monitor · Lifeline' }, { name: 'description', content: 'View available Bluetooth readings, sensor status and emergency actions.' }, { property: 'og:title', content: 'Monitor · Lifeline' }, { property: 'og:description', content: 'View available Bluetooth readings, sensor status and emergency actions.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Monitor,
})

const KEYS: VitalKey[] = ['bp', 'glucose', 'hr', 'spo2']

function Monitor() {
  const PATIENT = useApp((s) => s.profile)
  const demo = useApp((s) => s.demoMode)
  const scenario = useApp((s) => s.scenario)
  const vitals = useApp((s) => s.vitals)
  const thresholds = useApp((s) => s.thresholds)
  const log = useApp((s) => s.log)
  const device = useApp((s) => s.device)
  const now = useNow()

  const statuses = KEYS.map((k) => ({ k, s: isStale(k, vitals[k], now) ? 'unknown' : classify(k, vitals[k], thresholds[k]) }))
  const crit = statuses.filter((x) => x.s === 'critical')
  const warn = statuses.filter((x) => x.s === 'warning')
  const anyData = statuses.some((x) => x.s !== 'unknown')

  const headline = !anyData
    ? { t: device.status === 'connected' ? 'Waiting for device readings' : demo ? 'Preparing demo readings' : 'No device connected', d: device.status === 'connected' ? 'The connection is open, but no fresh measurements are available.' : 'Connect a Bluetooth health device, or switch on demo mode to try Lifeline.', c: 'text-foreground' }
    : crit.length
      ? { t: `${VITAL_META[crit[0].k].label} critical`, d: 'Alarm triggers after 3 s sustained beyond your limit.', c: 'text-critical' }
      : warn.length
        ? { t: `Watching ${VITAL_META[warn[0].k].label.toLowerCase()}`, d: 'Close to your limit. No alarm yet.', c: 'text-warning' }
        : { t: 'Available readings in range', d: 'Only readings your connected device provides are shown. Keep this page open to monitor.', c: 'text-foreground' }

  return (
    <main id="main-content" className="mx-auto max-w-6xl px-4 pb-32 pt-6">
      {demo && (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-3 text-sm text-foreground ring-1 ring-warning-soft">
          <FlaskConical className="size-4.5 shrink-0" />
          <p className="mr-auto"><b>DEMO MODE: no real alerts.</b> Readings are simulated. Automatic alarms won't contact anyone — the SOS button always works for real.</p>
          <Button onClick={() => set({ demoMode: false, scenario: 'stable', vitals: {}, history: {bp:[],hr:[],spo2:[],glucose:[]} })} className="rounded-full bg-warning px-3 py-1.5 text-xs font-bold text-primary-foreground">Use real devices</Button>
        </div>
      )}

      {/* Patient + devices */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{PATIENT.name || 'Your monitoring session'}</span>
        {demo ? (
          <span className="flex items-center gap-1.5"><Bluetooth className="size-4 text-primary" />{DEMO_DEVICE.name} · <Battery className="size-4" />{DEMO_DEVICE.battery}%</span>
        ) : device.status === 'connected' ? (
          <span className="flex items-center gap-1.5 text-success"><Bluetooth className="size-4" />{device.name} · connected ({device.vitals.join(', ')})</span>
        ) : (
          <span className="flex items-center gap-1.5"><Bluetooth className="size-4" />
            {device.status === 'connecting' ? 'Connecting…' : device.status === 'reconnecting' ? `Reconnecting to ${device.name}…` : device.status === 'error' ? device.error : device.status === 'disconnected' ? `${device.name} disconnected` : 'No device paired'}
          </span>
        )}
        <div className="ml-auto flex gap-2">
          {device.status === 'connected' || device.status === 'reconnecting' ? (
            <Button variant="outline" onClick={disconnectWearable} className="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border hover:bg-card">Disconnect</Button>
          ) : (
            <Button
              onClick={() => pairWearable().catch((e: Error) => e.name !== 'NotFoundError' && alert(e.message))}
              className="flex items-center gap-1 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground"
            >
              <Bluetooth className="size-3.5" /> Connect wearable
            </Button>
          )}
          {!demo && device.status !== 'connected' && (
            <Button variant="outline" onClick={() => set({ demoMode: true })} className="rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-border hover:bg-card">Try demo mode</Button>
          )}
        </div>
      </div>

      {/* Headline + SOS */}
      <section className="mt-6 flex flex-wrap items-center gap-6 border-y border-border py-7">
        <div className="mr-auto">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-normal text-muted-foreground"><ShieldCheck className="size-4" /> Status</p>
          <h1 className={`mt-2 font-display text-3xl font-extrabold tracking-normal sm:text-5xl ${headline.c}`}>{headline.t}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{headline.d}</p>
        </div>
        <SosButton />
      </section>

      {/* Vitals */}
      <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KEYS.map((k, i) => <VitalCard key={k} k={k} delay={i * 70} />)}
      </section>

      {demo && (
        <section className="mt-5 border-b border-border py-5">
          <h2 className="text-sm font-semibold text-muted-foreground">Simulate a reading</h2>
          <p className="text-xs text-muted-foreground">Push the demo feed into danger zones to see detection, the alarm and the first-aid assistant.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SCENARIOS.map((sc) => (
              <Button
                key={sc.key}
                onClick={() => set({ scenario: sc.key })}
                variant={scenario === sc.key ? 'secondary' : 'outline'} aria-pressed={scenario === sc.key} className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${scenario === sc.key ? 'bg-secondary text-foreground' : 'bg-muted text-foreground hover:bg-muted'}`}
              >
                {sc.label}
              </Button>
            ))}
          </div>
        </section>
      )}

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <LocationCard />
        <MotionCard />
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <article className="rounded-lg bg-secondary p-5 text-foreground shadow-sm">
          <h2 className="text-sm font-semibold text-muted-foreground">Medical profile</h2>
          <p className="mt-1 text-xs text-muted-foreground">Included in messages you choose to send.</p>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-xs text-muted-foreground">Blood type</dt><dd className="font-mono text-2xl font-bold">{PATIENT.bloodType || '—'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Age</dt><dd className="font-mono text-2xl font-bold">{PATIENT.age ?? '—'}</dd></div>
            <div className="col-span-2"><dt className="text-xs text-muted-foreground">Conditions</dt><dd>{PATIENT.conditions.join(' · ') || 'Not entered'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Allergies</dt><dd className="text-critical">{PATIENT.allergies.join(' · ') || 'Not entered'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Medications</dt><dd>{PATIENT.medications.join(' · ') || 'Not entered'}</dd></div>
          </dl>
          <Link to="/contacts" className="mt-3 inline-block rounded px-2 py-3.5 text-xs font-semibold text-primary hover:underline">Emergency contacts →</Link>
        </article>
        <article className="rounded-lg bg-card p-5 shadow-sm ring-1 ring-border">
          <h2 className="text-sm font-semibold text-muted-foreground">Activity log</h2>
          <ul className="mt-3 max-h-72 divide-y divide-border overflow-y-auto">
            {log.map((l) => (
              <li key={l.id} className="flex gap-3 py-2.5 text-sm">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${l.kind === 'alarm' || l.kind === 'sos' ? 'bg-destructive' : l.kind === 'cancel' ? 'bg-warning' : l.kind === 'location' ? 'bg-primary' : 'bg-muted'}`} />
                <span className="mr-auto text-foreground">{l.text}</span>
                <time className="shrink-0 text-xs text-muted-foreground">{formatWhen(l.at, now)}</time>
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
