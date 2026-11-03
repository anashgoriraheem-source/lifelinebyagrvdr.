import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { advanceDispatch, cancelDispatch } from "@/lib/dispatch.functions";
import { ATTEMPT_STATE_LABEL } from "@/lib/alertMessage";
import { INCIDENT_STATUS_LABEL, type DispatchView } from "@/lib/alertTypes";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MessageSquare, Phone, Radio } from "lucide-react";

const CHANNEL_ICON = { sms: MessageSquare, call: Phone } as const;

/**
 * Truthful incident panel: every row is a stored provider state, never an
 * inference. While a countdown is still running it offers a cancel button; once
 * dispatch has started it only reports and lets the person stop escalation.
 */
export function AlertStatusPanel({
  eventId,
  initial,
  onCanceled,
}: {
  eventId: string;
  initial?: DispatchView | null;
  onCanceled?: () => void;
}) {
  const [view, setView] = useState<DispatchView | null>(initial ?? null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const advance = useServerFn(advanceDispatch);
  const cancel = useServerFn(cancelDispatch);

  useEffect(() => {
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const next = await advance({ data: { eventId } });
        if (active) {
          setView(next);
          setError("");
        }
      } catch {
        if (active) setError("The alert status could not be refreshed. Check your connection.");
      }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [advance, eventId]);

  if (!view) {
    return (
      <p role="status" className="text-sm text-muted-foreground">
        {error || "Loading alert status…"}
      </p>
    );
  }

  const remaining =
    view.cancelDeadline && view.incidentStatus === "countdown"
      ? Math.max(0, Math.ceil((view.cancelDeadline - now) / 1000))
      : 0;
  // A blocked or finished incident has nothing to stop: offering the button
  // there would suggest an escalation that is not happening.
  const active =
    view.status === "active" &&
    !["blocked", "failed", "acknowledged", "resolved", "canceled"].includes(view.incidentStatus);

  const stop = async () => {
    setBusy(true);
    try {
      const next = await cancel({
        data: { eventId, reason: "Canceled by the user in Lifeline" },
      });
      setView(next);
      onCanceled?.();
    } catch {
      setError("The alert could not be canceled. Call your contact directly.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        {view.mode === "test" ? (
          <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-primary">
            Test mode
          </span>
        ) : (
          <span className="rounded-full bg-critical-soft px-2 py-0.5 text-xs font-bold text-critical">
            Live alerts
          </span>
        )}
        <p className="font-semibold" role="status" aria-live="polite">
          {INCIDENT_STATUS_LABEL[view.incidentStatus] ?? view.incidentStatus}
          {remaining > 0 ? ` · ${remaining}s` : ""}
        </p>
        {active && view.incidentStatus !== "countdown" && (
          <Button
            variant="outline"
            className="ms-auto min-h-10"
            onClick={stop}
            disabled={busy}
          >
            Stop escalation
          </Button>
        )}
      </div>

      {view.incidentStatus === "countdown" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <p className="text-sm">
            Lifeline will send the alert automatically when the countdown ends. Nobody has been
            contacted yet.
          </p>
          <Button variant="destructive" className="min-h-11" onClick={stop} disabled={busy}>
            Cancel alert now
          </Button>
        </div>
      )}

      {view.blockedReason && (
        <p className="mt-3 flex items-start gap-2 rounded-lg bg-warning-soft p-3 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {view.blockedReason}
        </p>
      )}

      {view.attempts.length > 0 && (
        <ul className="mt-3 divide-y divide-border">
          {view.attempts.map((a) => {
            const Icon = CHANNEL_ICON[a.channel];
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="font-semibold">{a.contactName}</span>
                <span className="text-xs text-muted-foreground">
                  {a.channel === "sms" ? "Text message" : "Call"}
                </span>
                <span className="ms-auto text-end text-xs font-semibold">
                  {ATTEMPT_STATE_LABEL[a.status as keyof typeof ATTEMPT_STATE_LABEL] ?? a.status}
                </span>
                {a.error && <span className="w-full text-xs text-muted-foreground">{a.error}</span>}
              </li>
            );
          })}
        </ul>
      )}

      {view.attempts.length === 0 && view.incidentStatus !== "countdown" && (
        <p className="mt-3 text-sm text-muted-foreground">
          No attempt was recorded for this alert. Check that a contact has recorded consent and a
          channel selected.
        </p>
      )}

      {view.timeline.length > 0 && (
        <details className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          <summary className="min-h-9 cursor-pointer py-2 font-semibold">Alert timeline</summary>
          <ol className="space-y-1">
            {view.timeline.slice(-12).map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className="font-mono">
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>{" "}
                {e.kind}
                {e.detail ? ` — ${e.detail}` : ""}
              </li>
            ))}
          </ol>
        </details>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-critical">
          {error}
        </p>
      )}
      <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <Radio className="size-3.5" aria-hidden="true" />
        Status comes from the messaging provider. An answered call is not an acknowledgement; only
        the contact pressing 1 is.
      </p>
    </div>
  );
}
