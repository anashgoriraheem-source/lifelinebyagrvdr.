import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { listAlertHistory } from '@/lib/alerts.functions'
import { ATTEMPT_STATUS_LABEL, CHANNEL_LABEL, type AlertHistoryEvent } from '@/lib/alertPlan'
import { clockTime } from '@/lib/sos'

export function AlertHistory() {
  const userId = useApp((s) => s.userId)
  const alertRecord = useApp((s) => s.alertRecord)
  const load = useServerFn(listAlertHistory)
  const [events, setEvents] = useState<AlertHistoryEvent[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!userId) {
      setEvents([])
      setStatus('idle')
      return
    }
    let active = true
    setStatus('loading')
    load()
      .then((res) => { if (active) { setEvents(res.events); setStatus('ready') } })
      .catch(() => { if (active) setStatus('error') })
    return () => { active = false }
  }, [load, userId, alertRecord, reloadKey])

  if (!userId) return null

  return (
    <section className="border-t border-border mt-5 py-6">
      <div className="flex items-center gap-3">
        <div className="mr-auto">
          <h2 className="font-display text-xl font-bold">Alarm history</h2>
          <p className="text-sm text-muted-foreground">Alarms are recorded here in test mode. Nothing in this list has been sent to anyone.</p>
        </div>
        <Button onClick={() => setReloadKey((k) => k + 1)} disabled={status === 'loading'} className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-background">
          {status === 'loading' ? 'Loading…' : 'Refresh'}
        </Button>
      </div>

      {status === 'error' && <p role="alert" className="mt-4 text-sm text-critical">Alarm history could not be loaded. Try again.</p>}
      {status === 'ready' && events.length === 0 && (
        <div className="mt-4 rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">No alarms recorded yet.</div>
      )}

      <ul className="mt-4 space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg bg-background p-3 ring-1 ring-border">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto font-semibold">{e.reason_label}</p>
              {e.is_demo && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">Demo</span>}
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-primary">Test mode</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{clockTime(new Date(e.started_at).getTime())} · {e.reason_reading}</p>
            {e.attempts.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No saved contacts were set to receive messages or calls.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {e.attempts.map((a, i) => (
                  <li key={`${a.contact_name}-${a.channel}-${i}`} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <span className="mr-auto">{CHANNEL_LABEL[a.channel as 'sms' | 'call'] ?? a.channel} to {a.contact_name}</span>
                    <span className="text-xs font-semibold text-muted-foreground">{ATTEMPT_STATUS_LABEL[a.status] ?? a.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
