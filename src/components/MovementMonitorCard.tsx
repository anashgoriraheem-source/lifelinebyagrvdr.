import { useEffect, useState } from "react";
import { AlertTriangle, FlaskConical, Move3d, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MovementDemoTrigger } from "@/components/MovementDemoTrigger";
import { useApp } from "@/hooks/useApp";
import { INCIDENT_STATUS_LABEL } from "@/lib/alertTypes";
import {
  movementEngineView,
  movementRuntime,
  type MovementRuntimeState,
} from "@/lib/movementRuntime";
import {
  TRACE_LABEL,
  UNAVAILABLE_COPY,
  type MovementPhase,
  type TraceKind,
} from "@/lib/movementMonitor";

const PHASE_LABEL: Record<MovementPhase, string> = {
  idle: "Not started",
  starting: "Starting…",
  active: "Monitoring",
  paused: "Paused",
  unavailable: "Unavailable",
};

const TRACE_ORDER: TraceKind[] = ["stillness", "jolt", "walking", "rotation", "set-down"];

function useMovementState(): MovementRuntimeState {
  const [state, setState] = useState<MovementRuntimeState>(movementRuntime.getState);
  useEffect(() => movementRuntime.subscribe(() => setState(movementRuntime.getState())), []);
  return state;
}

/**
 * Movement and jolt monitor. One card covering the setup explanation, the live
 * monitoring state, the phone-motion fall/jolt detector and a test mode that
 * replays synthetic traces. Every alarm it raises goes through the app's
 * existing alarm → incident → escalation flow; nothing here contacts
 * anyone, and test mode never opens an alarm.
 */
export function MovementMonitorCard() {
  const runtime = useMovementState();
  const alarm = useApp((s) => s.alarm);
  const dispatch = useApp((s) => s.dispatch);
  const demo = useApp((s) => s.demoMode);
  // Re-render twice a second so the stillness counter and reading age advance.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 500);
    return () => clearInterval(id);
  }, []);
  const view = movementEngineView(movementRuntime);
  const phase = runtime.phase;
  const running = runtime.running;
  const lastSampleAge =
    view.lastSampleAt == null ? null : Math.max(0, Math.round((performance.now() - view.lastSampleAt) / 1000));

  const statusTone =
    phase === "active"
      ? "bg-success-soft text-success ring-success-soft"
      : phase === "paused" || phase === "starting"
        ? "bg-warning-soft text-warning ring-warning-soft"
        : phase === "unavailable"
          ? "bg-critical-soft text-critical ring-critical-soft"
          : "bg-muted text-muted-foreground ring-border";

  const statusSentence =
    phase === "active"
      ? `Monitoring is on. Reading this phone's motion sensor${view.calibrated ? "" : " — still calibrating"}. Keep the page open.`
      : phase === "paused"
        ? "Monitoring is paused. No stillness or jolt alarm will be raised while paused."
        : phase === "starting"
          ? "Asking the browser for motion access…"
          : phase === "unavailable" && runtime.reason
            ? UNAVAILABLE_COPY[runtime.reason]
            : "Monitoring is off. Nothing is being watched.";

  return (
    <article
      className="rounded-lg bg-card p-5 shadow-sm ring-1 ring-border"
      aria-labelledby="movement-monitor-heading"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-accent text-primary">
          <Move3d className="size-4" />
        </span>
        <h2 id="movement-monitor-heading" className="mr-auto text-sm font-semibold text-muted-foreground">
          Movement &amp; jolt monitor
        </h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${statusTone}`}>
          {PHASE_LABEL[phase]}
        </span>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm leading-relaxed">
        {statusSentence}
      </p>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">MOTION NOW</dt>
          <dd className="font-mono text-lg font-bold tabular">
            {view.dynamicMs2 == null ? "—" : `${view.dynamicMs2.toFixed(1)} m/s²`}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">STILL FOR</dt>
          <dd className="font-mono text-lg font-bold tabular">
            {phase === "active" || phase === "paused"
              ? `${Math.floor(view.stillSeconds)} s`
              : "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">
            STILLNESS ALARM IN
          </dt>
          <dd className="font-mono text-lg font-bold tabular">
            {phase === "active" ? `${Math.ceil(view.remainingStillSeconds)} s` : "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[11px] font-semibold tracking-wide text-muted-foreground">
            LAST READING
          </dt>
          <dd className="font-mono text-lg font-bold tabular">
            {lastSampleAge == null ? "—" : `${lastSampleAge} s ago`}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs text-muted-foreground">
        Readiness:{" "}
        {view.calibrated
          ? "ready — the sensor stream is fresh and gravity reads normally."
          : `calibrating (${Math.min(view.samples, 20)} of 20 readings).`}{" "}
        A 60-second stillness alarm is only possible while this page is open on the device that
        produces the readings.
      </p>

      {!running && (
        <section className="mt-4 rounded-lg border border-border p-4">
          <h3 className="text-sm font-bold">Set this up before you rely on it</h3>
          <ul className="mt-2 space-y-2 text-sm leading-relaxed">
            <li>
              <strong>Sensor used:</strong> this browser's phone motion sensor
              (accelerometer). No watch or Bluetooth device sends motion to Lifeline, so the
              readings come only from the phone holding this page.
            </li>
            <li>
              <strong>Position:</strong> keep the phone on your person — pocket, waistband or
              held — while monitoring. Lying it on a table measures the table, not you.
            </li>
            <li>
              <strong>Stillness:</strong> 60 continuous seconds with almost no movement.
              Stillness is a sensor pattern, not proof that someone is unconscious.
            </li>
            <li>
              <strong>Strong jolt:</strong> one very large, very fast spike in acceleration. It
              is not proof of a fall or an injury, and ordinary walking or turning the phone over
              is filtered out.
            </li>
            <li>
              <strong>What happens:</strong> Lifeline opens its normal alarm with a short
              cancellation countdown, then uses your saved automatic emergency-contact calls and
              texts — only if you turned those on and your contacts consented.
            </li>
            <li>
              <strong>Cancel a false alarm:</strong> press “I’m OK — cancel the automatic alert”
              during the countdown. If nobody responds, escalation continues.
            </li>
            <li>
              <strong>Limits:</strong> nothing runs in the background. If the browser is closed,
              the tab is in the background, or the sensor stops, monitoring shows as unavailable
              and no alarm is possible.
            </li>
          </ul>
          <Button className="mt-4 min-h-12 w-full sm:w-auto" onClick={() => void movementRuntime.start()}>
            <Play className="me-2 size-4" />
            Start monitoring
          </Button>
        </section>
      )}

      {running && (
        <div className="mt-4 flex flex-wrap gap-2">
          {runtime.paused ? (
            <Button variant="outline" className="min-h-11" onClick={() => movementRuntime.resume()}>
              <Play className="me-2 size-4" />
              Resume monitoring
            </Button>
          ) : (
            <Button variant="outline" className="min-h-11" onClick={() => movementRuntime.pause()}>
              <Pause className="me-2 size-4" />
              Pause monitoring
            </Button>
          )}
          <Button variant="outline" className="min-h-11" onClick={() => movementRuntime.stop()}>
            <Square className="me-2 size-4" />
            Stop monitoring
          </Button>
        </div>
      )}

      <section className="mt-5 rounded-lg border border-border p-4" aria-labelledby="movement-test-heading">
        <h3 id="movement-test-heading" className="flex items-center gap-2 text-sm font-bold">
          <FlaskConical className="size-4" aria-hidden="true" />
          Test mode
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Replays a synthetic motion trace through the same detector. Test mode never opens an
          alarm and never calls or messages a contact.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {TRACE_ORDER.map((kind) => (
            <Button
              key={kind}
              variant="outline"
              className="min-h-11 text-xs"
              onClick={() => movementRuntime.runTest(kind)}
            >
              {TRACE_LABEL[kind]}
            </Button>
          ))}
        </div>
        {runtime.lastTest && (
          <div className="mt-3 rounded-lg bg-muted/40 p-3 text-sm">
            <p className="font-semibold">Test: {TRACE_LABEL[runtime.lastTest.kind]}</p>
            <p className="mt-1">{runtime.lastTest.verdict}</p>
            {runtime.lastTest.events.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {runtime.lastTest.events.map((event, index) => (
                  <li key={`${event.type}-${index}`}>
                    {Math.round(event.at / 1000)} s · {event.type} · {event.detail}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs font-semibold">Test only — nothing was sent or called.</p>
          </div>
        )}
      </section>

      {runtime.lastEvent && (
        <section className="mt-5 rounded-lg border border-border p-4" aria-live="polite">
          <h3 className="flex items-center gap-2 text-sm font-bold">
            <AlertTriangle className="size-4 text-warning" aria-hidden="true" />
            Most recent sensor event
          </h3>
          <p className="mt-2 text-sm">
            <strong>
              {runtime.lastEvent.source === "stillness"
                ? "Stillness"
                : runtime.lastEvent.source === "jolt"
                  ? "Possible impact"
                  : "Fall detector"}
            </strong>{" "}
            · {runtime.lastEvent.detail} ·{" "}
            {new Date(runtime.lastEvent.at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="mt-1 text-sm">
            {runtime.lastEvent.alarmOpened
              ? "This event opened a Lifeline alarm."
              : "An alarm was already open, so no second alarm or incident was created for it."}
            {alarm.phase !== "idle" && (
              <>
                {" "}
                Alarm is {alarm.phase === "countdown" ? "counting down" : "open"}.
              </>
            )}
          </p>
          {dispatch && (
            <p className="mt-1 text-xs text-muted-foreground">
              Automatic alert: {INCIDENT_STATUS_LABEL[dispatch.incidentStatus] ?? dispatch.incidentStatus}
              {dispatch.mode === "test" ? " · test mode, no real contact is messaged" : ""}
            </p>
          )}
        </section>
      )}

      <MovementDemoTrigger />

      <p className="mt-4 rounded-md bg-warning-soft px-2.5 py-1.5 text-xs leading-snug text-warning">
        Unvalidated detector: thresholds come from recorded phone traces and have not been tested on
        physical devices by a clinician or engineer. {demo ? "Demo mode is on, so alarms raised now are marked demo. " : ""}
        Lifeline never calls public emergency services from a sensor event.
      </p>
    </article>
  );
}
