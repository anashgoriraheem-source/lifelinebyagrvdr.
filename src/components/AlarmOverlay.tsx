import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Ambulance, Check, Copy, MapPin, MessageSquare, Phone, Share2, Shield, Volume2, VolumeX } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { cancelAlarm, dispatchAlarm, emergencyNumbers } from '@/lib/store'
import { startTracking } from '@/lib/location'
import { startSiren, stopSiren } from '@/lib/siren'
import { buildSosMessage, clockTime, mapsLink, smsHref, telHref } from '@/lib/sos'
import { PATIENT } from '@/lib/fixtures'

export function AlarmOverlay() {
  const alarm = useApp((s) => s.alarm)
  const countdown = useApp((s) => s.countdownSeconds)
  if (alarm.phase === 'idle') return null
  return alarm.phase === 'countdown' ? <Countdown total={countdown} /> : <Dispatched />
}

function Countdown({ total }: { total: number }) {
  const alarm = useApp((s) => s.alarm)
  const [left, setLeft] = useState(total)

  useEffect(() => {
    startSiren()
    startTracking()
    const started = alarm.startedAt ?? Date.now()
    const id = setInterval(() => {
      const l = Math.max(0, total - Math.floor((Date.now() - started) / 1000))
      setLeft(l)
      if (l === 0) dispatchAlarm()
    }, 200)
    return () => {
      clearInterval(id)
      stopSiren()
    }
  }, [alarm.startedAt, total])

  return (
    <div role="alertdialog" aria-live="assertive" className="fixed inset-0 z-40 flex flex-col items-center justify-between overflow-y-auto bg-rose-600 px-6 py-10 text-white">
      {alarm.demo && <DemoStrip />}
      <div className="mt-6 text-center">
        <AlertTriangle className="mx-auto size-12 animate-flash" strokeWidth={2.2} />
        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.25em] text-rose-100">Emergency detected</p>
        <h2 className="mt-2 font-display text-4xl font-extrabold sm:text-5xl">{alarm.reason?.label}</h2>
        <p className="mt-2 font-mono text-lg text-rose-100">{alarm.reason?.reading}</p>
      </div>
      <div className="my-8 grid place-items-center">
        <div className="relative grid size-52 place-items-center rounded-full border-8 border-white/30">
          <span className="font-display text-8xl font-extrabold tabular">{left}</span>
        </div>
        <p className="mt-4 max-w-xs text-center text-rose-50">
          Calling for help in {left} s. Your location and medical details will be shared.
        </p>
      </div>
      <div className="flex w-full max-w-sm flex-col gap-3">
        <HoldToCancel />
        <button onClick={dispatchAlarm} className="rounded-2xl border-2 border-white/60 py-4 text-lg font-bold transition hover:bg-white/10">
          Get help now
        </button>
      </div>
    </div>
  )
}

/** Cancelling needs a deliberate 1.5 s hold so a fall or a pocket press can't dismiss it. */
function HoldToCancel() {
  const [p, setP] = useState(0)
  const raf = useRef<number | null>(null)
  const begin = () => {
    const t0 = performance.now()
    const step = () => {
      const v = Math.min(1, (performance.now() - t0) / 1500)
      setP(v)
      if (v >= 1) return cancelAlarm('cancelled by wearer')
      raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }
  const end = () => {
    if (raf.current) cancelAnimationFrame(raf.current)
    setP(0)
  }
  return (
    <button
      onPointerDown={begin}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
      className="relative h-20 select-none touch-none overflow-hidden rounded-2xl bg-white text-xl font-extrabold text-rose-700 shadow-2xl"
    >
      <span className="absolute inset-y-0 left-0 bg-emerald-400/40" style={{ width: `${p * 100}%` }} />
      <span className="relative">{p > 0 ? 'Keep holding…' : "I'm OK — hold to cancel"}</span>
    </button>
  )
}

function DemoStrip() {
  return (
    <div className="w-full max-w-xl rounded-xl bg-amber-300 px-4 py-2 text-center text-sm font-bold text-amber-950">
      DEMO MODE · no real alerts · nobody will be contacted
    </div>
  )
}

function Dispatched() {
  const alarm = useApp((s) => s.alarm)
  const loc = useApp((s) => s.location)
  const contacts = useApp((s) => s.contacts)
  const n = useApp(emergencyNumbers)
  const [done, setDone] = useState<Record<string, boolean>>({})
  const [siren, setSiren] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    startTracking()
    return () => stopSiren()
  }, [])
  useEffect(() => (siren ? startSiren() : stopSiren()), [siren])

  const msg = buildSosMessage(alarm.reason, loc.fix, { test: alarm.demo })
  const smsContacts = contacts.filter((c) => c.sms)
  const mark = (k: string) => setDone((d) => ({ ...d, [k]: true }))

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Emergency — Lifeline', text: msg })
      else {
        await navigator.clipboard.writeText(msg)
        setCopied(true)
      }
      mark('share')
    } catch {
      /* user dismissed */
    }
  }

  const resolve = () => {
    const okMsg = `${PATIENT.name} is safe now — the Lifeline alert at ${clockTime(alarm.startedAt ?? Date.now())} is resolved. Thank you.`
    if (!alarm.demo && Object.keys(done).length && smsContacts.length && confirm('Send an "I\'m OK" message to your contacts?')) {
      window.location.href = smsHref(smsContacts.map((c) => c.phone), okMsg)
    }
    cancelAlarm('marked resolved')
  }

  return (
    <div role="alertdialog" className="fixed inset-0 z-40 overflow-y-auto bg-slate-950 text-white">
      <div className="bg-rose-600 px-5 pb-6 pt-8">
        <div className="mx-auto max-w-2xl">
          {alarm.demo && <DemoStrip />}
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-rose-100">
            {alarm.reason?.label} · {clockTime(alarm.startedAt ?? Date.now())}
          </p>
          <h2 className="mt-1 font-display text-3xl font-extrabold sm:text-4xl">
            {alarm.demo ? 'Demo alert — this is what happens next' : 'Get help now'}
          </h2>
          <p className="mt-1 text-rose-50">
            {alarm.demo ? 'In a real alert these buttons call and message your contacts.' : 'Tap to call. Messages open in your phone with your location attached — press Send.'}
          </p>
          <a
            href={alarm.demo ? undefined : telHref(n.general)}
            onClick={() => mark('call-general')}
            aria-disabled={alarm.demo}
            className={`mt-5 flex items-center justify-center gap-3 rounded-2xl bg-white py-5 text-2xl font-extrabold text-rose-700 shadow-2xl ${alarm.demo ? 'pointer-events-none opacity-60' : 'active:scale-[0.98]'}`}
          >
            <Phone className="size-7" strokeWidth={2.6} /> Call emergency {n.general}
          </a>
        </div>
      </div>

      <div className="mx-auto grid max-w-2xl gap-4 px-5 py-6">
        {/* Location */}
        <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <MapPin className="size-4 text-rose-400" /> Live location
            <span className="ml-auto text-xs font-medium text-slate-400">
              {loc.status === 'tracking' && loc.fix ? `±${Math.round(loc.fix.accuracy)} m · ${clockTime(loc.fix.at)}` : loc.status === 'denied' ? 'Permission denied' : 'Locating…'}
            </span>
          </div>
          {loc.fix ? (
            <a href={mapsLink(loc.fix)} target="_blank" rel="noreferrer" className="mt-2 block font-mono text-sm text-sky-300 underline-offset-4 hover:underline">
              {loc.fix.lat.toFixed(5)}, {loc.fix.lng.toFixed(5)} — open map
            </a>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              {loc.status === 'denied' ? 'Enable location for this site so responders can find you. Say your address when you call.' : 'Getting a GPS fix. Messages sent now will say location is unavailable.'}
            </p>
          )}
        </section>

        {/* Emergency services */}
        <section className="grid grid-cols-2 gap-3">
          <ServiceButton icon={<Shield className="size-5" />} label="Police" number={n.police} demo={alarm.demo} onUse={() => mark('police')} done={done.police} />
          <ServiceButton icon={<Ambulance className="size-5" />} label="Ambulance" number={n.ambulance} demo={alarm.demo} onUse={() => mark('ambulance')} done={done.ambulance} />
          <a
            href={alarm.demo ? undefined : smsHref([n.smsNumber], msg)}
            onClick={() => mark('sms-112')}
            className={`col-span-2 flex items-center gap-3 rounded-2xl bg-rose-500/15 p-4 ring-1 ring-rose-400/30 ${alarm.demo ? 'pointer-events-none opacity-50' : 'hover:bg-rose-500/25'}`}
          >
            <MessageSquare className="size-5 text-rose-300" />
            <span className="flex-1">
              <span className="block font-semibold">Text police & ambulance ({n.smsNumber})</span>
              <span className="block text-xs text-slate-400">Emergency SMS where your region supports it. If unsure, call.</span>
            </span>
            {done['sms-112'] && <Check className="size-5 text-emerald-400" />}
          </a>
        </section>

        {/* Contacts */}
        <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Your emergency contacts</h3>
            {smsContacts.length > 0 && (
              <a
                href={alarm.demo ? undefined : smsHref(smsContacts.map((c) => c.phone), msg)}
                onClick={() => mark('sms-all')}
                className={`rounded-full bg-white px-3 py-1.5 text-sm font-bold text-slate-900 ${alarm.demo ? 'pointer-events-none opacity-50' : ''}`}
              >
                {done['sms-all'] ? '✓ ' : ''}Message all
              </a>
            )}
          </div>
          <ul className="mt-3 divide-y divide-white/10">
            {contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-white/10 text-sm font-bold">{c.name[0]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{c.name}</span>
                  <span className="block text-xs text-slate-400">{c.relationship} · {c.phone}</span>
                </span>
                {c.sms && (
                  <a aria-label={`Text ${c.name}`} href={alarm.demo ? undefined : smsHref([c.phone], msg)} onClick={() => mark(`s-${c.id}`)} className={`grid size-10 place-items-center rounded-full ${done[`s-${c.id}`] ? 'bg-emerald-500' : 'bg-white/10'} ${alarm.demo ? 'pointer-events-none opacity-50' : ''}`}>
                    <MessageSquare className="size-4" />
                  </a>
                )}
                {c.call && (
                  <a aria-label={`Call ${c.name}`} href={alarm.demo ? undefined : telHref(c.phone)} onClick={() => mark(`c-${c.id}`)} className={`grid size-10 place-items-center rounded-full ${done[`c-${c.id}`] ? 'bg-emerald-500' : 'bg-white/10'} ${alarm.demo ? 'pointer-events-none opacity-50' : ''}`}>
                    <Phone className="size-4" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>

        {/* Message preview */}
        <section className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
          <div className="flex items-center gap-2">
            <h3 className="mr-auto font-semibold">Message being sent</h3>
            <button onClick={share} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-sm hover:bg-white/20">
              {copied ? <Copy className="size-4" /> : <Share2 className="size-4" />} {copied ? 'Copied' : 'Share'}
            </button>
          </div>
          <pre className="mt-3 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300">{msg}</pre>
        </section>

        <div className="flex flex-wrap gap-3 pb-[48dvh] sm:pb-28">
          <button onClick={() => setSiren((v) => !v)} className="flex items-center gap-2 rounded-2xl bg-white/10 px-4 py-3 font-semibold hover:bg-white/20">
            {siren ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />} {siren ? 'Stop siren' : 'Sound siren'}
          </button>
          <button onClick={resolve} className="flex-1 rounded-2xl bg-emerald-500 px-4 py-3 font-bold text-emerald-950 hover:bg-emerald-400">
            I'm safe — mark resolved
          </button>
        </div>
      </div>
    </div>
  )
}

function ServiceButton(props: { icon: React.ReactNode; label: string; number: string; demo: boolean; done?: boolean; onUse: () => void }) {
  return (
    <a
      href={props.demo ? undefined : telHref(props.number)}
      onClick={props.onUse}
      className={`flex items-center gap-3 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 ${props.demo ? 'pointer-events-none opacity-50' : 'hover:bg-white/10'}`}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-white/10">{props.icon}</span>
      <span className="flex-1">
        <span className="block text-sm text-slate-400">{props.label}</span>
        <span className="block font-mono text-xl font-bold">{props.number}</span>
      </span>
      {props.done && <Check className="size-5 text-emerald-400" />}
    </a>
  )
}

