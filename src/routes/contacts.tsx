import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowDown, ArrowUp, Ambulance, Flame, MessageSquare, Pencil, Phone, Plus, RotateCcw, Shield, Siren, Trash2, X } from 'lucide-react'
import { useApp } from '@/hooks/useApp'
import { DEFAULT_THRESHOLDS, EMERGENCY_BY_COUNTRY, RELATIONSHIPS } from '@/lib/fixtures'
import { emergencyNumbers, set } from '@/lib/store'
import { VITAL_META } from '@/lib/detection'
import { buildSosMessage, isValidPhone, smsHref, telHref } from '@/lib/sos'
import type { Contact, VitalKey } from '@/lib/types'

export const Route = createFileRoute('/contacts')({
  ssr: false,
  head: () => ({ meta: [{ title: 'Contacts & alerts · Lifeline' }] }),
  component: Contacts,
})

const card = 'rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6'

function Contacts() {
  const contacts = useApp((s) => s.contacts)
  const country = useApp((s) => s.countryCode)
  const countdown = useApp((s) => s.countdownSeconds)
  const thresholds = useApp((s) => s.thresholds)
  const fix = useApp((s) => s.location.fix)
  const n = useApp(emergencyNumbers)
  const [editing, setEditing] = useState<Contact | 'new' | null>(null)

  const move = (i: number, d: -1 | 1) =>
    set((s) => {
      const c = [...s.contacts]
      const j = i + d
      if (j < 0 || j >= c.length) return {}
      ;[c[i], c[j]] = [c[j], c[i]]
      return { contacts: c }
    })
  const patch = (id: string, p: Partial<Contact>) => set((s) => ({ contacts: s.contacts.map((c) => (c.id === id ? { ...c, ...p } : c)) }))
  const smsList = contacts.filter((c) => c.sms)

  return (
    <main className="mx-auto max-w-4xl px-4 pb-32 pt-6">
      <h1 className="font-display text-4xl font-extrabold tracking-tight">Contacts & alerts</h1>
      <p className="mt-1 text-slate-500">Who Lifeline reaches in an emergency, in what order, and when.</p>

      {/* Emergency services */}
      <section className={`${card} mt-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-display text-xl font-bold">Emergency services</h2>
          <label className="text-sm text-slate-500">
            Country{' '}
            <select value={country} onChange={(e) => set({ countryCode: e.target.value })} className="ml-1 rounded-lg border border-slate-300 bg-white px-2 py-1 text-slate-900">
              {Object.entries(EMERGENCY_BY_COUNTRY).map(([code, v]) => <option key={code} value={code}>{v.country}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Emergency', num: n.general, icon: Siren, c: 'bg-rose-600 text-white' },
            { label: 'Police', num: n.police, icon: Shield, c: 'bg-slate-100' },
            { label: 'Ambulance', num: n.ambulance, icon: Ambulance, c: 'bg-slate-100' },
            { label: 'Fire', num: n.fire, icon: Flame, c: 'bg-slate-100' },
          ].map((x) => (
            <a key={x.label} href={telHref(x.num)} className={`rounded-2xl p-4 transition hover:-translate-y-0.5 ${x.c}`}>
              <x.icon className="size-5 opacity-80" />
              <p className="mt-2 text-xs font-semibold opacity-70">{x.label}</p>
              <p className="font-mono text-2xl font-bold">{x.num}</p>
            </a>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Lifeline never auto-dials emergency services. During an alert you get a one-tap call button and an SMS to {n.smsNumber} pre-filled with your location and medical details, where your region accepts emergency SMS.
        </p>
      </section>

      {/* Personal contacts */}
      <section className={`${card} mt-5`}>
        <div className="flex items-center gap-3">
          <div className="mr-auto">
            <h2 className="font-display text-xl font-bold">Personal contacts</h2>
            <p className="text-sm text-slate-500">Top of the list is contacted first.</p>
          </div>
          <button onClick={() => setEditing('new')} className="flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white">
            <Plus className="size-4" /> Add
          </button>
        </div>
        {contacts.length === 0 && (
          <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            No contacts yet. Add at least one person who should hear from you in an emergency.
          </div>
        )}
        <ol className="mt-4 space-y-2">
          {contacts.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
              <span className="grid size-7 place-items-center rounded-full bg-slate-900 font-mono text-xs font-bold text-white">{i + 1}</span>
              <div className="mr-auto min-w-0">
                <p className="truncate font-semibold">{c.name}</p>
                <p className="text-xs text-slate-500">{c.relationship} · <span className="font-mono">{c.phone}</span></p>
              </div>
              <Toggle on={c.call} onClick={() => patch(c.id, { call: !c.call })} icon={<Phone className="size-3.5" />} label="Call" />
              <Toggle on={c.sms} onClick={() => patch(c.id, { sms: !c.sms })} icon={<MessageSquare className="size-3.5" />} label="SMS" />
              <div className="flex">
                <IconBtn label="Move up" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="size-4" /></IconBtn>
                <IconBtn label="Move down" onClick={() => move(i, 1)} disabled={i === contacts.length - 1}><ArrowDown className="size-4" /></IconBtn>
                <IconBtn label="Edit" onClick={() => setEditing(c)}><Pencil className="size-4" /></IconBtn>
                <IconBtn label="Delete" onClick={() => confirm(`Remove ${c.name}?`) && set((s) => ({ contacts: s.contacts.filter((x) => x.id !== c.id) }))}><Trash2 className="size-4" /></IconBtn>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">
          <p className="mr-auto">Check your contacts get your messages. The test is clearly labelled and asks for no action.</p>
          <a
            href={smsList.length ? smsHref(smsList.map((c) => c.phone), buildSosMessage({ type: 'sos', label: 'Test alert', reading: 'checking Lifeline works' }, fix, { test: true })) : undefined}
            className={`rounded-full bg-sky-700 px-4 py-2 font-bold text-white ${smsList.length ? '' : 'pointer-events-none opacity-40'}`}
          >
            Send a test alert
          </a>
        </div>
      </section>

      {/* Countdown */}
      <section className={`${card} mt-5`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Cancel countdown</h2>
          <span className="font-mono text-3xl font-bold">{countdown === 0 ? 'Instant' : `${countdown}s`}</span>
        </div>
        <p className="text-sm text-slate-500">Time you get to press "I'm OK" before help is called. SOS is always instant.</p>
        <input type="range" min={0} max={60} value={countdown} onChange={(e) => set({ countdownSeconds: Number(e.target.value) })} className="mt-4 w-full accent-rose-600" />
      </section>

      {/* Thresholds */}
      <section className={`${card} mt-5`}>
        <div className="flex items-center">
          <h2 className="mr-auto font-display text-xl font-bold">Critical limits</h2>
          <button onClick={() => set({ thresholds: DEFAULT_THRESHOLDS })} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-slate-300 hover:bg-slate-50">
            <RotateCcw className="size-3.5" /> Reset to defaults
          </button>
        </div>
        <p className="text-sm text-slate-500">Talk to your doctor before changing these.</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="pb-2 font-semibold">Vital</th><th className="pb-2 font-semibold">Below</th><th className="pb-2 font-semibold">Above</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(Object.keys(VITAL_META) as VitalKey[]).map((k) => (
              <tr key={k}>
                <td className="py-2.5 pr-2 font-medium">{VITAL_META[k].label} <span className="text-xs text-slate-400">{VITAL_META[k].unit}</span></td>
                {(['below', 'above'] as const).map((f) => (
                  <td key={f} className="py-2.5 pr-2">
                    <input
                      type="number"
                      value={thresholds[k][f] ?? ''}
                      placeholder="—"
                      onChange={(e) => set((s) => ({ thresholds: { ...s.thresholds, [k]: { ...s.thresholds[k], [f]: e.target.value === '' ? null : Number(e.target.value) } } }))}
                      className="w-20 rounded-lg border border-slate-300 px-2 py-1 font-mono"
                    />
                    {k === 'bp' && f === 'above' && <span className="ml-1 text-xs text-slate-400">sys · dia &gt; {thresholds.bp.above2}</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {editing && <ContactForm initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </main>
  )
}

function Toggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${on ? 'bg-emerald-600 text-white' : 'bg-white text-slate-400 ring-1 ring-slate-300'}`}>
      {icon}{label}
    </button>
  )
}

function IconBtn({ children, label, ...rest }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <button type="button" aria-label={label} title={label} {...rest} className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-white hover:text-slate-900 disabled:opacity-30">{children}</button>
}

function ContactForm({ initial, onClose }: { initial: Contact | null; onClose: () => void }) {
  const [f, setF] = useState<Contact>(initial ?? { id: `c${Date.now()}`, name: '', relationship: 'Daughter', phone: '+91 ', call: true, sms: true })
  const [touched, setTouched] = useState(false)
  const phoneOk = isValidPhone(f.phone)
  const nameOk = f.name.trim().length > 1
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!phoneOk || !nameOk) return
    set((s) => ({ contacts: initial ? s.contacts.map((c) => (c.id === f.id ? f : c)) : [...s.contacts, f] }))
    onClose()
  }
  const input = 'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-slate-300'
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 p-2 backdrop-blur-sm sm:place-items-center" onClick={onClose}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center">
          <h3 className="mr-auto font-display text-xl font-bold">{initial ? 'Edit contact' : 'New contact'}</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-slate-100"><X className="size-4" /></button>
        </div>
        <label className="mt-4 block text-sm font-medium">Name
          <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          {touched && !nameOk && <span className="text-xs text-rose-600">Enter a name.</span>}
        </label>
        <label className="mt-3 block text-sm font-medium">Relationship
          <select className={input} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">Phone (with country code)
          <input className={`${input} font-mono`} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          {touched && !phoneOk && <span className="text-xs text-rose-600">Enter a valid number, e.g. +91 98765 43210.</span>}
        </label>
        <div className="mt-4 flex gap-2">
          <Toggle on={f.call} onClick={() => setF({ ...f, call: !f.call })} icon={<Phone className="size-3.5" />} label="Call" />
          <Toggle on={f.sms} onClick={() => setF({ ...f, sms: !f.sms })} icon={<MessageSquare className="size-3.5" />} label="SMS" />
        </div>
        <button className="mt-6 w-full rounded-2xl bg-slate-900 py-3 font-bold text-white">Save contact</button>
      </form>
    </div>
  )
}
