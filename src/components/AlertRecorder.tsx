import { useEffect, useRef } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { useApp } from '@/hooks/useApp'
import { recordAlarmEvent } from '@/lib/alerts.functions'
import { buildAlertIdempotencyKey } from '@/lib/alertPlan'
import { appStore, set } from '@/lib/store'

export function AlertRecorder() {
  const alarm = useApp((s) => s.alarm)
  const userId = useApp((s) => s.userId)
  const record = useServerFn(recordAlarmEvent)
  const lastKey = useRef<string | null>(null)

  useEffect(() => {
    if (alarm.phase === 'idle' || !alarm.reason || alarm.startedAt === null) return
    const startedAt = alarm.startedAt
    const key = buildAlertIdempotencyKey(startedAt, alarm.reason.type)
    if (lastKey.current === key) return
    lastKey.current = key

    if (!userId) {
      set({ alertRecord: 'signed-out' })
      return
    }
    set({ alertRecord: 'saving' })
    const isCurrent = () => lastKey.current === key && appStore.state.alarm.startedAt === startedAt
    record({
      data: {
        idempotencyKey: key,
        reasonType: alarm.reason.type,
        reasonLabel: alarm.reason.label,
        reasonReading: alarm.reason.reading,
        isDemo: alarm.demo,
        startedAt,
      },
    })
      .then(() => { if (isCurrent()) set({ alertRecord: 'saved' }) })
      .catch(() => { if (isCurrent()) set({ alertRecord: 'error' }) })
  }, [alarm, userId, record])

  return null
}
