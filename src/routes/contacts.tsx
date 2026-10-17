import { Button } from '@/components/ui/button'
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
  head: () => ({ meta: [{ title: 'Contacts and alerts · Lifeline' }, { name: 'description', content: 'Manage your personal emergency contacts and alert preferences.' }, { property: 'og:title', content: 'Contacts and alerts · Lifeline' }, { property: 'og:description', content: 'Manage your personal emergency contacts and alert preferences.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Contacts,
})

const card = 'border-t border-border py-6'

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
    <main id="main-content" className="mx-auto max-w-4xl px-4 pb-32 pt-6">
      <h1 className="font-display text-4xl font-extrabold tracking-normal">Contacts & alerts</h1>
      <p className="mt-1 text-muted-foreground">Your trusted people and emergency calling preferences.</p>

      {/* Emergency services */}
      <section className={`${card} mt-6`}>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="mr-auto font-display text-xl font-bold">Emergency services</h2>
          <label className="text-sm text-muted-foreground">
            Country{' '}
            <select value={country} onChange={(e) => set({ countryCode: e.target.value })} className="ml-1 rounded-lg border border-border bg-card px-2 py-1 text-foreground">
              {Object.entries(EMERGENCY_BY_COUNTRY).map(([code, v]) => <option key={code} value={code}>{v.country}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Emergency', num: n.general, icon: Siren, c: 'bg-destructive text-primary-foreground' },
            { label: 'Police', num: n.police, icon: Shield, c: 'bg-muted' },
            { label: 'Ambulance', num: n.ambulance, icon: Ambulance, c: 'bg-muted' },
            { label: 'Fire', num: n.fire, icon: Flame, c: 'bg-muted' },
          ].map((x) => (
            <a key={x.label} href={telHref(x.num)} className={`rounded-lg p-4 transition hover:-translate-y-0.5 ${x.c}`}>
              <x.icon className="size-5 opacity-80" />
              <p className="mt-2 text-xs font-semibold opacity-70">{x.label}</p>
              <p className="font-mono text-2xl font-bold">{x.num}</p>
            </a>
          ))}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
          Lifeline never auto-dials emergency services. During an alert you get a one-tap call button and an SMS to {n.smsNumber} pre-filled with your location and medical details, where your region accepts emergency SMS.
        </p>
      </section>

      {/* Personal contacts */}
      <section className={`${card} mt-5`}>
        <div className="flex items-center gap-3">
          <div className="mr-auto">
            <h2 className="font-display text-xl font-bold">Personal contacts</h2>
            <p className="text-sm text-muted-foreground">First in the list is your primary contact. Saved locally on this device.</p>
          </div>
          <Button onClick={() => setEditing('new')} className="flex items-center gap-1.5 rounded-full bg-secondary px-4 py-2 text-sm font-bold text-primary-foreground">
            <Plus className="size-4" /> Add
          </Button>
        </div>
        {contacts.length === 0 && (
          <div className="mt-5 rounded-lg border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No contacts yet. Add at least one person who should hear from you in an emergency.
          </div>
        )}
        <ol className="mt-4 space-y-2">
          {contacts.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-background p-3 ring-1 ring-border">
              <span className="grid size-7 place-items-center rounded-full bg-secondary font-mono text-xs font-bold text-primary-foreground">{i + 1}</span>
              <div className="mr-auto min-w-0">
                <p className="truncate font-semibold">{c.name}{i === 0 && <span className="ml-2 text-xs text-primary">Primary</span>}</p>
                <p className="text-xs text-muted-foreground">{c.relationship} · <span className="font-mono">{c.phone}</span></p>
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
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-lg bg-accent p-4 text-sm text-primary">
          <p className="mr-auto">Opens a labelled test in your messaging app. You must press Send; delivery is not confirmed here.</p>
          <a
            href={smsList.length ? smsHref(smsList.map((c) => c.phone), buildSosMessage({ type: 'sos', label: 'Test alert', reading: 'checking Lifeline works' }, fix, { test: true })) : undefined}
            className={`rounded-full bg-primary px-4 py-2 font-bold text-primary-foreground ${smsList.length ? '' : 'pointer-events-none opacity-40'}`}
          >
            Prepare test message
          </a>
        </div>
      </section>

      {/* Countdown */}
      <section className={`${card} mt-5`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl font-bold">Cancel countdown</h2>
          <span className="font-mono text-3xl font-bold">{countdown === 0 ? 'Instant' : `${countdown}s`}</span>
        </div>
        <p className="text-sm text-muted-foreground">Time to cancel before call and message actions appear. SOS opens those actions immediately.</p>
        <input type="range" min={0} max={60} value={countdown} onChange={(e) => set({ countdownSeconds: Number(e.target.value) })} className="mt-4 w-full accent-destructive" />
      </section>

      {/* Thresholds */}
      <section className={`${card} mt-5`}>
        <div className="flex items-center">
          <h2 className="mr-auto font-display text-xl font-bold">Critical limits</h2>
          <Button onClick={() => set({ thresholds: DEFAULT_THRESHOLDS })} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-background">
            <RotateCcw className="size-3.5" /> Reset to defaults
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">Talk to your doctor before changing these.</p>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-normal text-muted-foreground">
              <th className="pb-2 font-semibold">Vital</th><th className="pb-2 font-semibold">Below</th><th className="pb-2 font-semibold">Above</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(Object.keys(VITAL_META) as VitalKey[]).map((k) => (
              <tr key={k}>
                <td className="py-2.5 pr-2 font-medium">{VITAL_META[k].label} <span className="text-xs text-muted-foreground">{VITAL_META[k].unit}</span></td>
                {(['below', 'above'] as const).map((f) => (
                  <td key={f} className="py-2.5 pr-2">
                    <input
                      type="number"
                      value={thresholds[k][f] ?? ''}
                      placeholder="—"
                      onChange={(e) => set((s) => ({ thresholds: { ...s.thresholds, [k]: { ...s.thresholds[k], [f]: e.target.value === '' ? null : Number(e.target.value) } } }))}
                      className="w-full max-w-20 rounded-lg border border-border px-2 py-1 font-mono"
                    />
                    {k === 'bp' && f === 'above' && <span className="ml-1 text-xs text-muted-foreground">sys · dia &gt; {thresholds.bp.above2}</span>}
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
    <Button type="button" onClick={onClick} aria-pressed={on} className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition ${on ? 'bg-success text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-border'}`}>
      {icon}{label}
    </Button>
  )
}

function IconBtn({ children, label, ...rest }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return <Button type="button" aria-label={label} title={label} {...rest} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-card hover:text-foreground disabled:opacity-30">{children}</Button>
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
  const input = 'mt-1 w-full rounded-lg border border-border px-3 py-2.5 outline-none focus:ring-2 focus:ring-border'
  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-secondary/40 p-2  sm:place-items-center" onClick={onClose} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <form onSubmit={save} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="contact-form-title" className="w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center">
          <h3 id="contact-form-title" className="mr-auto font-display text-xl font-bold">{initial ? 'Edit contact' : 'New contact'}</h3>
          <Button type="button" onClick={onClose} aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-muted"><X className="size-4" /></Button>
        </div>
        <label className="mt-4 block text-sm font-medium">Name
          <input className={input} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
          {touched && !nameOk && <span className="text-xs text-critical">Enter a name.</span>}
        </label>
        <label className="mt-3 block text-sm font-medium">Relationship
          <select className={input} value={f.relationship} onChange={(e) => setF({ ...f, relationship: e.target.value })}>
            {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-sm font-medium">Phone (with country code)
          <input className={`${input} font-mono`} inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          {touched && !phoneOk && <span className="text-xs text-critical">Enter a valid number, e.g. +91 98765 43210.</span>}
        </label>
        <div className="mt-4 flex gap-2">
          <Toggle on={f.call} onClick={() => setF({ ...f, call: !f.call })} icon={<Phone className="size-3.5" />} label="Call" />
          <Toggle on={f.sms} onClick={() => setF({ ...f, sms: !f.sms })} icon={<MessageSquare className="size-3.5" />} label="SMS" />
        </div>
        <Button className="mt-6 w-full rounded-lg bg-secondary py-3 font-bold text-primary-foreground">Save contact</Button>
      </form>
    </div>
  )
}
