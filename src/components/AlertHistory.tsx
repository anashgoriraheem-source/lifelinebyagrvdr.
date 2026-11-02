import { useEffect, useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { useApp } from '@/hooks/useApp'
import { listAlertHistory } from '@/lib/alerts.functions'
import { ATTEMPT_STATUS_LABEL, CHANNEL_LABEL, type AlertHistoryEvent } from '@/lib/alertPlan'
import { clockTime } from '@/lib/sos'
import { useI18n } from "@/i18n"

export function AlertHistory() {
  const { t } = useI18n()
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
          <h2 className="font-display text-xl font-bold">{t("contacts.historyHeading")}</h2>
          <p className="text-sm text-muted-foreground">{t("contacts.historyIntro")}</p>
        </div>
        <Button onClick={() => setReloadKey((k) => k + 1)} disabled={status === 'loading'} className="rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-border hover:bg-background">
          {status === 'loading' ? t("common.loading") : t("contacts.historyRefresh")}
        </Button>
      </div>

      {status === 'error' && <p role="alert" className="mt-4 text-sm text-critical">{t("contacts.historyError")}</p>}
      {status === 'ready' && events.length === 0 && (
        <div className="mt-4 rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">{t("contacts.historyEmpty")}</div>
      )}

      <ul className="mt-4 space-y-2">
        {events.map((e) => (
          <li key={e.id} className="rounded-lg bg-background p-3 ring-1 ring-border">
            <div className="flex flex-wrap items-center gap-2">
              <p className="mr-auto font-semibold">{e.reason_label}</p>
              {e.is_demo && <span className="rounded-full bg-warning-soft px-2 py-0.5 text-xs font-bold text-warning">{t("contacts.demoBadge")}</span>}
              <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-primary">{t("contacts.testBadge")}</span>
            </div>
            <p className="font-mono text-xs text-muted-foreground">{clockTime(new Date(e.started_at).getTime())} · {e.reason_reading}</p>
            {e.attempts.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">{t("contacts.historyNoContacts")}</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {e.attempts.map((a, i) => (
                  <li key={`${a.contact_name}-${a.channel}-${i}`} className="flex flex-wrap items-center gap-2 py-1.5 text-sm">
                    <span className="mr-auto">
                      {t("contacts.historyAttempt", {
                        channel: CHANNEL_LABEL[a.channel as 'sms' | 'call'] ?? a.channel,
                        contact: a.contact_name,
                      })}
                    </span>
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
