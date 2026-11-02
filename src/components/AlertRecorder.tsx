import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useApp } from "@/hooks/useApp";
import { advanceDispatch, dispatchEmergency, getDispatchState } from "@/lib/dispatch.functions";
import { buildAlertIdempotencyKey } from "@/lib/alertPlan";
import { appStore, set } from "@/lib/store";

/**
 * Records a deliberate SOS and starts the server-side contact dispatch once the
 * alarm becomes active. The countdown deliberately does NOT contact anybody: the
 * user can still cancel. Demo alarms are recorded as simulated attempts.
 *
 * While the incident screen is open, queued voice escalation and one bounded
 * retry are advanced every few seconds. Without a scheduled job, nothing
 * progresses after the tab is closed — the UI states this.
 */
export function AlertRecorder() {
  const alarm = useApp((s) => s.alarm);
  const userId = useApp((s) => s.userId);
  const dispatch = useApp((s) => s.dispatch);
  const dispatchState = useApp((s) => s.dispatchState);
  const record = useServerFn(dispatchEmergency);
  const advance = useServerFn(advanceDispatch);
  const readState = useServerFn(getDispatchState);
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (alarm.phase !== "active" || !alarm.reason || alarm.startedAt === null) {
      if (alarm.phase === "countdown") set({ dispatchState: "countdown" });
      return;
    }
    const startedAt = alarm.startedAt;
    const reason = alarm.reason;
    const key = buildAlertIdempotencyKey(startedAt, reason.type);
    if (lastKey.current === key) return;
    lastKey.current = key;

    if (!userId) {
      set({ dispatchState: "signed-out", alertRecord: "signed-out" });
      return;
    }
    set({ dispatchState: "sending", alertRecord: "saving" });
    const isCurrent = () => lastKey.current === key && appStore.state.alarm.startedAt === startedAt;
    const loc = appStore.state.location.fix;
    record({
      data: {
        idempotencyKey: key,
        reasonType: reason.type,
        reasonLabel: reason.label,
        reasonReading: reason.reading,
        isDemo: alarm.demo,
        startedAt,
        location: loc ? { lat: loc.lat, lng: loc.lng, accuracy: loc.accuracy, at: loc.at } : null,
      },
    })
      .then((view) => {
        if (!isCurrent()) return;
        set({ dispatch: view, dispatchState: "ready", alertRecord: "saved" });
      })
      .catch(() => {
        if (!isCurrent()) return;
        set({ dispatchState: "error", alertRecord: "error" });
      });
  }, [alarm, userId, record]);

  // Poll while an incident is open so provider outcomes and escalation stay truthful.
  useEffect(() => {
    const eventId = dispatch?.eventId;
    if (!eventId || dispatch?.status !== "active") return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const view =
          dispatch?.mode === "live" && dispatch.liveReady
            ? await advance({ data: { eventId } })
            : await readState({ data: { eventId } });
        if (active && appStore.state.dispatch?.eventId === eventId) set({ dispatch: view });
      } catch {
        /* keep the last known state rather than inventing an outcome */
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [
    dispatch?.eventId,
    dispatch?.status,
    dispatch?.mode,
    dispatch?.liveReady,
    advance,
    readState,
  ]);

  return null;
}
