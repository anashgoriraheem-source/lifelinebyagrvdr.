import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Activity, Bell, Bluetooth, MapPin, ShieldAlert, ShieldCheck, Siren } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { useNow } from '@/hooks/useNow'
import { isStale } from '@/lib/detection'
import { VITAL_KEYS, dayKey, weekOf } from '@/lib/readingDays'
import type { LogEntry, VitalKey } from '@/lib/types'
import '../styles/dashboard.css'

declare global {
  interface Window {
    /** The entrance plays once per page load, never again on remount. */
    __lifelineDashEntered?: boolean
  }
}

/** One reading of each supported vital is the daily target. */
const GOAL = VITAL_KEYS.length
/** The plot's top sits above the goal line so it is always visible. */
const HEADROOM = 0.08
const SETUP_STEPS = 4
/** Counts run 800 → 1500ms after mount, like the rest of the entrance. */
const COUNT_START = 800
const COUNT_MS = 700
const ENTER_MS = 1600

type Route = '/contacts' | '/monitor' | '/account'

const ROW_META: Record<LogEntry['kind'], { icon: typeof Siren; to: Route }> = {
  alarm: { icon: Siren, to: '/contacts' },
  sos: { icon: ShieldAlert, to: '/contacts' },
  cancel: { icon: ShieldCheck, to: '/contacts' },
  location: { icon: MapPin, to: '/monitor' },
  device: { icon: Bluetooth, to: '/monitor' },
  info: { icon: Activity, to: '/monitor' },
}

/* ---------------------------------------------------------------- instruments
   Thin tick marks, built from value / goal only — the numbers drive them. */

function polar(radius: number, angle: number) {
  return { x: 72 + radius * Math.sin(angle), y: 72 - radius * Math.cos(angle) }
}

function RadialTicks({ value, goal, progress }: { value: number; goal: number; progress: number }) {
  const ratio = goal > 0 ? Math.min(1, value / goal) : 0
  const ticks = 40
  const every = 5
  const lit = Math.round(ratio * ticks * progress)
  const angles = Array.from({ length: ticks }, (_, i) => (i / ticks) * 2 * Math.PI)
  return (
    <div className="dash-gauge" role="img" aria-label={`${Math.round(ratio * 100)}% — ${value} of ${goal}`}>
      <svg viewBox="0 0 144 144" aria-hidden="true">
        {angles.map((angle, i) => {
          const from = polar(36.6, angle)
          const to = polar(62.7, angle)
          return (
            <line
              key={`t${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              strokeWidth={1.5}
              stroke={i < lit ? 'currentColor' : 'var(--dash-off)'}
            />
          )
        })}
        {angles.map((angle, i) => {
          if (i % every) return null
          const dot = polar(71.1, angle)
          return <circle key={`d${i}`} cx={dot.x} cy={dot.y} r={1.12} fill={i < lit ? 'currentColor' : 'var(--dash-off)'} />
        })}
      </svg>
      <span className="dash-gauge-pct" aria-hidden="true">
        {Math.round(ratio * 100 * progress)}%
      </span>
    </div>
  )
}

function TickStrip({ value, goal, progress }: { value: number; goal: number; progress: number }) {
  const ratio = goal > 0 ? Math.min(1, value / goal) : 0
  const ticks = 49
  const every = 12
  const lit = Math.round(ratio * ticks * progress)
  return (
    <div className="dash-ticks" role="img" aria-label={`${value} of ${goal} supported readings live`}>
      {Array.from({ length: ticks }, (_, i) => (
        <span key={i} className="dash-tcell">
          {i % every === 0 && <span className="dash-mark" style={{ opacity: i < lit ? 1 : 0.4 }} />}
          <span className="dash-t" style={{ opacity: i < lit ? 1 : 0.4 }} />
        </span>
      ))}
    </div>
  )
}

function GroupedTicks({ value, goal, progress }: { value: number; goal: number; progress: number }) {
  const groups = 12
  const per = 5
  const total = groups * per
  const ratio = goal > 0 ? Math.min(1, value / goal) : 0
  const lit = Math.round(ratio * total * progress)
  return (
    <div className="dash-groups" role="img" aria-label={`${value} of ${goal} contacts can receive an alert`}>
      {Array.from({ length: groups }, (_, g) => (
        <span key={g} className="dash-group">
          {Array.from({ length: per }, (_, j) => {
            const index = g * per + j
            return (
              <span
                key={j}
                className={`dash-t${index < lit ? '' : ' is-off'}${index % (3 * per) === 0 ? ' is-major' : ''}`}
              />
            )
          })}
        </span>
      ))}
    </div>
  )
}

/* --------------------------------------------------------------- dashboard */

export function DashboardOverview() {
  const vitals = useApp((s) => s.vitals)
  const device = useApp((s) => s.device)
  const contacts = useApp((s) => s.contacts)
  const location = useApp((s) => s.location)
  const profile = useApp((s) => s.profile)
  const demo = useApp((s) => s.demoMode)
  const readingDays = useApp((s) => s.readingDays)
  const log = useApp((s) => s.log)
  const alarm = useApp((s) => s.alarm.phase)
  const now = useNow(5000)

  const [active, setActive] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState(0)
  const [entering, setEntering] = useState(false)
  const sticky = useRef<string | null>(null)
  const plotRef = useRef<HTMLDivElement>(null)
  const colRefs = useRef<(HTMLButtonElement | null)[]>([])
  const bellRef = useRef<HTMLDivElement>(null)

  // Entrance: once per page load. Without it everything paints complete.
  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || window.__lifelineDashEntered) {
      setProgress(1)
      return
    }
    window.__lifelineDashEntered = true
    setEntering(true)
    let frame = 0
    const start = performance.now() + COUNT_START
    const step = () => {
      const p = Math.min(1, Math.max(0, (performance.now() - start) / COUNT_MS))
      setProgress(p)
      if (p < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    const end = window.setTimeout(() => setEntering(false), ENTER_MS)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(end)
    }
  }, [])

  // Bell panel: Escape closes it and returns focus to the bell.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      bellRef.current?.querySelector('button')?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  // A tapped bar stays active until the next tap outside the chart (touch only).
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!sticky.current || plotRef.current?.contains(e.target as Node)) return
      sticky.current = null
      setActive(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [])

  const fresh = VITAL_KEYS.filter((k) => vitals[k] && !isStale(k, vitals[k], now))
  const receiving = device.status === 'connected' && fresh.length > 0
  const setupDone = [contacts.length > 0, receiving, location.status === 'tracking', Boolean(profile.name && profile.age != null)]
  const doneCount = setupDone.filter(Boolean).length
  const reachable = contacts.filter((c) => c.call || c.sms).length

  const headline =
    alarm !== 'idle'
      ? 'An alert is open on this device'
      : demo
        ? 'Demo readings are on — nobody is contacted'
        : contacts.length === 0
          ? 'No emergency contacts saved yet'
          : doneCount < SETUP_STEPS
            ? `${SETUP_STEPS - doneCount} setup step${SETUP_STEPS - doneCount === 1 ? '' : 's'} left`
            : receiving
              ? 'Readings are arriving from your device'
              : 'Monitoring is off right now'

  const dateLine = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' }).format(now)

  const todayKey = dayKey(now)
  const week = weekOf(new Date(now))
  const values = week.map((d) => (d.date > todayKey ? null : (readingDays[d.date]?.length ?? 0)))
  const highest = Math.max(0, ...values.map((v) => v ?? 0))
  const top = Math.max(GOAL, highest) + GOAL * HEADROOM
  const known = values.filter((v): v is number => v !== null)
  const average = known.length ? Math.round(known.reduce((a, b) => a + b, 0) / known.length) : 0
  const goalPct = (GOAL / top) * 100

  const activeIndex = active ? week.findIndex((d) => d.date === active) : -1
  const activeValue = activeIndex >= 0 ? values[activeIndex] : null
  const metric =
    activeValue === null
      ? { pre: 'Avg', value: average, unit: '/ day' }
      : { pre: week[activeIndex].short, value: activeValue, unit: 'vitals' }
  const highlighted = activeValue !== null ? week[activeIndex].date : todayKey

  const needs: { title: string; detail: string; to: Route }[] = []
  if (!contacts.length) needs.push({ title: 'Add an emergency contact', detail: 'Nothing can be messaged when SOS is pressed', to: '/contacts' })
  if (!receiving) needs.push({ title: 'Connect a supported device', detail: 'Chrome or Edge on Android or desktop', to: '/monitor' })
  if (location.status !== 'tracking') needs.push({ title: 'Turn on location sharing', detail: 'Adds your position to alert messages', to: '/monitor' })
  if (!(profile.name && profile.age != null)) needs.push({ title: 'Finish your medical profile', detail: 'Name and age help responders', to: '/account' })

  const recent = log.slice(0, 3)
  const timeAgo = (at: number) => {
    const mins = Math.max(0, Math.round((now - at) / 60_000))
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.round(mins / 60)
    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`
  }

  const restore = () => {
    if (!sticky.current) setActive(null)
  }

  return (
    <section className="dash" aria-labelledby="dash-title" data-enter={entering ? '' : undefined}>
      <div className="dash-stage">
        <header className="dash-head">
          <div>
            <p className="dash-date">{dateLine}</p>
            <h2 className="dash-title" id="dash-title">
              {headline}
            </h2>
          </div>
          <div className="dash-bellwrap" ref={bellRef}>
            <Button
              variant="ghost"
              size="icon"
              className="dash-bell"
              aria-label="What needs your attention"
              aria-haspopup="dialog"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              <Bell className="size-[18px]" strokeWidth={1.6} />
            </Button>
            {open && (
              <div className="dash-notif" role="dialog" aria-label="What needs your attention">
                <p className="dash-notif-head">{needs.length ? 'Needs your attention' : 'Nothing needs you'}</p>
                {needs.length ? (
                  <ul className="dash-notif-list">
                    {needs.map((need) => (
                      <li key={need.title}>
                        <Link to={need.to} className="dash-notif-item" onClick={() => setOpen(false)}>
                          <span className="dash-notif-dot" aria-hidden="true" />
                          <span className="dash-notif-body">
                            <span className="dash-notif-text">{need.title}</span>
                            <span className="dash-notif-time">{need.detail}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="dash-notif-text">All four setup steps are done. AAPDA SETU still never contacts anyone automatically.</p>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="dash-cards">
          <div className="dash-kpis">
            <article className="dash-kpi" style={{ '--j': 0 } as React.CSSProperties}>
              <div className="dash-kpi-body dash-kpi-steps">
                <div className="dash-copy">
                  <p className="dash-label">Setup</p>
                  <p className="dash-num">
                    {Math.round(doneCount * progress)}
                    <small>/ {SETUP_STEPS} steps</small>
                  </p>
                  <p className="dash-note">{doneCount} of {SETUP_STEPS} setup steps done</p>
                </div>
                <RadialTicks value={doneCount} goal={SETUP_STEPS} progress={progress} />
              </div>
            </article>

            <article className="dash-kpi" style={{ '--j': 1 } as React.CSSProperties}>
              <div className="dash-kpi-body dash-copy">
                <p className="dash-label">Live readings</p>
                <p className="dash-num">
                  {Math.round(fresh.length * progress)}
                  <small>/ {GOAL} supported</small>
                </p>
                <TickStrip value={fresh.length} goal={GOAL} progress={progress} />
                <p className="dash-note">
                  {fresh.length ? `${fresh.length} of ${GOAL} supported readings live` : 'No live readings right now'}
                </p>
              </div>
            </article>

            <article className="dash-kpi" style={{ '--j': 2 } as React.CSSProperties}>
              <div className="dash-kpi-body dash-copy">
                <p className="dash-label">Contacts</p>
                <p className="dash-num">
                  {Math.round(reachable * progress)}
                  <small>/ {contacts.length} saved</small>
                </p>
                <GroupedTicks value={reachable} goal={contacts.length} progress={progress} />
                <p className="dash-note">
                  {contacts.length ? `${reachable} can receive an alert` : 'No emergency contacts saved yet'}
                </p>
              </div>
            </article>
          </div>

          <div className="dash-main">
            <article className="dash-card dash-chart">
              <div className="dash-cardhead">
                <h3 className="dash-h3">Vitals recorded (7d)</h3>
                <span className="dash-avg">
                  <span className="dash-avg-pre">{metric.pre}</span> <b>{metric.value}</b>{' '}
                  <span className="dash-avg-unit">{metric.unit}</span>
                </span>
              </div>
              <div className="dash-plotwrap">
                <div
                  className="dash-plot"
                  ref={plotRef}
                  role="group"
                  aria-label="Supported vitals recorded on each day of this week"
                  style={{ '--dash-goal': `${goalPct}%` } as React.CSSProperties}
                  onPointerLeave={restore}
                  onPointerMove={(e) => {
                    // The whole plot is the hover area: the bar under the pointer is
                    // the nearest column, so crossing a gap never jumps back to today.
                    if (e.pointerType !== 'mouse') return
                    let best = -1
                    let closest = Infinity
                    colRefs.current.forEach((col, index) => {
                      if (!col) return
                      const r = col.getBoundingClientRect()
                      const distance = e.clientX < r.left ? r.left - e.clientX : e.clientX > r.right ? e.clientX - r.right : 0
                      if (distance < closest) {
                        closest = distance
                        best = index
                      }
                    })
                    if (best >= 0 && values[best] !== null) setActive(week[best].date)
                  }}
                >
                  <div className="dash-goal" aria-hidden="true">
                    <span>Goal {GOAL}</span>
                  </div>
                  {week.map((day, i) => {
                    const value = values[i]
                    const future = value === null
                    const today = day.date === todayKey
                    const isActive = !future && highlighted === day.date
                    return (
                      <button
                        key={day.date}
                        ref={(el) => {
                          colRefs.current[i] = el
                        }}
                        type="button"
                        className={`dash-col${isActive ? ' is-active' : ''}${today ? ' is-today' : ''}${future ? ' is-future' : ''}`}
                        data-date={day.date}
                        style={{ '--h': `${future ? 0 : (value / top) * 100}%`, '--i': i } as React.CSSProperties}
                        aria-label={
                          future
                            ? `${day.long}, no readings yet`
                            : `${day.long}${today ? ' (today)' : ''}, ${value} of ${GOAL} supported vitals recorded`
                        }
                        aria-disabled={future || undefined}
                        tabIndex={future ? -1 : undefined}
                        onPointerUp={(e) => {
                          if (e.pointerType === 'mouse' || future) return
                          if (sticky.current === day.date) {
                            sticky.current = null
                            setActive(null)
                          } else {
                            sticky.current = day.date
                            setActive(day.date)
                          }
                        }}
                        onFocus={() => {
                          if (!future) setActive(day.date)
                        }}
                        onBlur={restore}
                        onKeyDown={(e) => {
                          const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
                          if (!step) return
                          let next = i + step
                          while (next >= 0 && next < week.length && values[next] === null) next += step
                          if (next < 0 || next >= week.length) return
                          e.preventDefault()
                          colRefs.current[next]?.focus()
                        }}
                      >
                        <span className="dash-reveal">
                          <span className="dash-fill">
                            <span className="dash-grad" />
                          </span>
                        </span>
                        <span className="dash-day" aria-hidden="true">
                          <span className="dash-day-name">{day.short}</span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="dash-days" aria-hidden="true" />
              </div>
              <p className="dash-foot">
                {demo ? 'Demo readings — simulated, never used for alerts.' : 'Counted on this device from supported readings. Values are not stored.'}
              </p>
            </article>

            <article className="dash-card dash-recent">
              <h3 className="dash-h3">Recent</h3>
              {recent.length ? (
                <ul className="dash-list">
                  {recent.map((row, i) => {
                    const meta = ROW_META[row.kind]
                    return (
                      <li key={row.id} style={{ '--j': i } as React.CSSProperties}>
                        <Link to={meta.to} className="dash-row">
                          <span className="dash-tile" aria-hidden="true">
                            <meta.icon className="size-[21px]" strokeWidth={1.6} />
                          </span>
                          <span className="dash-item-body">
                            <span className="dash-item-title">{row.text}</span>
                            <span className="dash-item-text">{timeAgo(row.at)}</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="dash-empty">
                  No activity on this device yet. Readings, alerts and connection events appear here for this session.
                </p>
              )}
            </article>
          </div>
        </div>
      </div>
    </section>
  )
}
