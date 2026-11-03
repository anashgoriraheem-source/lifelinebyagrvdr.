import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useApp } from "@/hooks/useApp";
import {
  advanceDispatch,
  cancelDispatch,
  dispatchEmergency,
  getDispatchState,
} from "@/lib/dispatch.functions";
import { buildAlertIdempotencyKey } from "@/lib/alertPlan";
import { appStore, set } from "@/lib/store";

/**
 * Creates the durable server-side incident for a qualifying alarm.
 *
 * The incident is created as soon as a countdown starts, so the server owns the
 * cancellation deadline: if the tab closes, the deadline still expires and the
 * dispatch continues. Dismissing the alarm during that window cancels it. A
 * deliberate SOS has no countdown and is dispatched immediately.
 *
 * Automatic alerts exist only when the person turned them on; otherwise the
 * server function returns null and the alarm keeps its manual call/message
 * actions. Nothing here fabricates a provider result: the panel shows the stored
 * state.
 */
export function AlertRecorder() {
  const alarm = useApp((s) => s.alarm);
  const userId = useApp((s) => s.userId);
  const dispatch = useApp((s) => s.dispatch);
  const record = useServerFn(dispatchEmergency);
  const advance = useServerFn(advanceDispatch);
  const readState = useServerFn(getDispatchState);
  const cancel = useServerFn(cancelDispatch);
  const lastKey = useRef<string | null>(null);
  const canceledKey = useRef<string | null>(null);

  useEffect(() => {
    const armed = alarm.phase === "countdown" || alarm.phase === "active";
    if (!armed || !alarm.reason || alarm.startedAt === null) return;
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
        // null means automatic alerts are off (or this trigger is not selected):
        // the alarm keeps its manual actions and nothing was sent.
        set({
          dispatch: view,
          dispatchState: view ? "ready" : "idle",
          alertRecord: view ? "saved" : "idle",
        });
      })
      .catch(() => {
        if (!isCurrent()) return;
        set({ dispatchState: "error", alertRecord: "error" });
      });
  }, [alarm.phase, alarm.reason, alarm.startedAt, alarm.demo, userId, record]);

  // Poll while an incident is open: countdown expiry and call escalation are
  // advanced on the server, so the page only observes stored state.
  useEffect(() => {
    const eventId = dispatch?.eventId;
    if (!eventId || dispatch?.status !== "active") return;
    let active = true;
    const id = setInterval(async () => {
      try {
        const view = await advance({ data: { eventId } });
        if (active && appStore.state.dispatch?.eventId === eventId) set({ dispatch: view });
      } catch {
        try {
          const view = await readState({ data: { eventId } });
          if (active && appStore.state.dispatch?.eventId === eventId) set({ dispatch: view });
        } catch {
          /* keep the last known state rather than inventing an outcome */
        }
      }
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [dispatch?.eventId, dispatch?.status, advance, readState]);

  // Dismissing the alarm during its countdown cancels the pending alert. After
  // dispatch has started, closing the screen does not silently stop escalation;
  // the person can stop it from the alert status panel.
  useEffect(() => {
    const eventId = dispatch?.eventId;
    if (!eventId) return;
    if (alarm.phase !== "idle") return;
    if (dispatch?.incidentStatus !== "countdown") return;
    if (canceledKey.current === eventId) return;
    canceledKey.current = eventId;
    cancel({ data: { eventId, reason: "Alarm dismissed during the countdown" } })
      .then((view) => set({ dispatch: view }))
      .catch(() => {
        /* the server still expires the deadline and dispatches; nothing hidden */
      });
  }, [alarm.phase, dispatch?.eventId, dispatch?.incidentStatus, cancel]);

  return null;
}
