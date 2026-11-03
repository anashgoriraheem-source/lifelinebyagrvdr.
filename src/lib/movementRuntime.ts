/**
 * The single motion-sensor listener in the app.
 *
 * One `devicemotion` subscription feeds both the existing fall detector
 * (`createFallDetector`) and the stillness/strong-jolt monitor
 * (`createMovementMonitor`), so a reading is never interpreted twice by two
 * different listeners and the UI can never show a state the stream disagrees
 * with.
 *
 * Responsibilities kept here (and only here):
 *  - permission, secure-context and support checks, requested only when the
 *    person presses Start;
 *  - sample freshness, gaps and tab visibility, so a quiet stream is reported
 *    as "monitoring unavailable" and never as stillness;
 *  - turning a qualifying event into the app's existing alarm (`raiseAlarm`),
 *    which is what opens one durable incident and, unchanged, escalates through
 *    the saved automatic-alert settings.
 *
 * Nothing in this file contacts anyone. Test mode does not come through here at
 * all: it replays synthetic traces through the pure engine.
 */
import {
  MOVEMENT_THRESHOLDS,
  createMovementMonitor,
  movementAvailability,
  runTrace,
  type MotionSample,
  type MovementEvent,
  type MovementPhase,
  type MovementPermission,
  type MovementSnapshot,
  type MovementUnavailableReason,
  type MovementThresholds,
  type TraceKind,
} from "./movementMonitor";
import { createFallDetector, INACTIVITY_MS, type FallEvent } from "./fallDetection";
import { addLog, appStore, raiseAlarm } from "./store";
import type { AlarmReason } from "./types";

export type MovementEventSource = "stillness" | "jolt" | "fall";

/** The three sensor sources a movement alarm can be announced from. */
export const ALARM_SOURCE_TYPES: MovementEventSource[] = ["stillness", "jolt", "fall"];

export interface ReportedMovementEvent {
  source: MovementEventSource;
  at: number;
  /** What the sensor actually measured, in plain words. */
  detail: string;
  /** True when this event opened the alarm; false when one was already open. */
  alarmOpened: boolean;
}

export interface MovementTestResult {
  kind: TraceKind;
  events: { type: MovementEvent["type"]; at: number; detail: string }[];
  /** One line the card shows verbatim: what the detector concluded. */
  verdict: string;
}

export interface MovementRuntimeState {
  supported: boolean;
  secureContext: boolean;
  permission: MovementPermission;
  running: boolean;
  paused: boolean;
  phase: MovementPhase;
  reason: MovementUnavailableReason | null;
  lastEvent: ReportedMovementEvent | null;
  lastTest: MovementTestResult | null;
}

export interface MovementRuntimeDeps {
  now: () => number;
  /** Opens the app's alarm. Returns true when a new alarm was actually opened. */
  raise: (reason: AlarmReason) => boolean;
  alarmIdle: () => boolean;
  demo: () => boolean;
  log: (text: string) => void;
}

const defaultDeps: MovementRuntimeDeps = {
  now: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
  raise: (reason) => {
    const before = appStore.state.alarm.phase;
    raiseAlarm(reason, { demo: appStore.state.demoMode });
    return before === "idle" && appStore.state.alarm.phase !== "idle";
  },
  alarmIdle: () => appStore.state.alarm.phase === "idle",
  demo: () => appStore.state.demoMode,
  log: (text) => addLog("info", text),
};

const STALE_STREAM_MS = 3_000;

export class MovementMonitorRuntime {
  private deps: MovementRuntimeDeps;
  private monitor = createMovementMonitor();
  private fall = createFallDetector();
  private listeners = new Set<() => void>();
  private detach: (() => void) | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private wake: { release(): Promise<void> } | null = null;
  private lastSampleAt: number | null = null;
  /** While the fall detector is checking for post-impact stillness, a jolt must
   * not open a second alarm for the same impact. */
  private fallCheckUntil = 0;
  private state: MovementRuntimeState = {
    supported: typeof window !== "undefined" && "DeviceMotionEvent" in window,
    secureContext: typeof window !== "undefined" ? Boolean(window.isSecureContext) : false,
    permission: typeof window !== "undefined" && "DeviceMotionEvent" in window ? "unknown" : "unsupported",
    running: false,
    paused: false,
    phase: "idle",
    reason: null,
    lastEvent: null,
    lastTest: null,
  };

  constructor(
    deps: Partial<MovementRuntimeDeps> = {},
    private thresholds: Partial<MovementThresholds> = {},
  ) {
    this.deps = { ...defaultDeps, ...deps };
  }

  /* ---------------- observation ---------------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): MovementRuntimeState => this.state;

  snapshot = (): MovementSnapshot => this.monitor.snapshot();

  private publish(patch: Partial<MovementRuntimeState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener();
  }

  /* ---------------- browser wiring ---------------- */

  /** Attaches the one listener. Safe to call twice (root mount + HMR). */
  attach() {
    if (this.detach || typeof window === "undefined") return;
    const supported = "DeviceMotionEvent" in window;
    const permission = this.state.permission;
    this.publish({
      supported,
      secureContext: Boolean(window.isSecureContext),
      permission: supported ? permission : "unsupported",
    });
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      this.handleSample({ x: a.x, y: a.y, z: a.z, t: this.deps.now() });
    };
    window.addEventListener("devicemotion", onMotion);
    const onVisibility = () => this.refreshAvailability();
    document.addEventListener("visibilitychange", onVisibility);
    this.watchdog = setInterval(() => this.refreshAvailability(), 1_000);
    this.detach = () => {
      window.removeEventListener("devicemotion", onMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      if (this.watchdog) clearInterval(this.watchdog);
      this.watchdog = null;
      void this.wake?.release().catch(() => {});
      this.wake = null;
    };
  }

  detachListener() {
    this.detach?.();
    this.detach = null;
  }

  /* ---------------- controls ---------------- */

  async start(): Promise<void> {
    if (typeof window === "undefined") return;
    if (!this.state.supported) {
      this.publish({ phase: "unavailable", reason: "unsupported" });
      return;
    }
    if (!window.isSecureContext) {
      this.publish({ phase: "unavailable", reason: "insecure-context" });
      return;
    }
    this.publish({ phase: "starting", reason: null });
    const DM = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    let permission: MovementPermission = "granted";
    if (typeof DM?.requestPermission === "function") {
      try {
        permission = (await DM.requestPermission()) === "granted" ? "granted" : "denied";
      } catch {
        permission = "denied";
      }
    }
    if (permission !== "granted") {
      this.publish({ permission, running: false, phase: "unavailable", reason: "permission-denied" });
      return;
    }
    this.monitor = createMovementMonitor(this.thresholds);
    this.fall = createFallDetector();
    this.lastSampleAt = null;
    this.fallCheckUntil = 0;
    this.publish({ permission, running: true, paused: false, phase: "unavailable", reason: "no-stream" });
    const nav = navigator as Navigator & {
      wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> };
    };
    try {
      this.wake = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* a screen lock is a convenience; monitoring works without it */
    }
    this.refreshAvailability();
  }

  pause() {
    if (!this.state.running) return;
    this.publish({ paused: true, phase: "paused", reason: null });
    this.log("Monitoring paused — nothing is being watched right now");
  }

  resume() {
    if (!this.state.running) return;
    // A resumed session starts a fresh stillness window: the time spent paused
    // is unknown, so it can never count towards "still for 60 seconds".
    this.monitor.reset();
    this.fall = createFallDetector();
    this.lastSampleAt = null;
    this.fallCheckUntil = 0;
    this.publish({ paused: false, phase: "unavailable", reason: "no-stream" });
    this.refreshAvailability();
  }

  stop() {
    this.monitor.reset();
    this.lastSampleAt = null;
    this.fallCheckUntil = 0;
    void this.wake?.release().catch(() => {});
    this.wake = null;
    this.publish({ running: false, paused: false, phase: "idle", reason: null });
    this.log("Monitoring stopped");
  }

  /** Replays a built-in synthetic trace. Never raises an alarm or contacts anyone. */
  runTest(kind: TraceKind): MovementTestResult {
    const result = runTrace(kind, this.thresholds);
    const events = result.events
      .filter((event) => event.type !== "gap")
      .map((event) => ({
        type: event.type,
        at: event.at,
        detail:
          event.type === "stillness"
            ? `Still for ${Math.round(event.stillMs / 1000)} s`
            : event.type === "jolt"
              ? `${event.peakG.toFixed(1)} g spike (${Math.round(event.peakMs2)} m/s² above gravity)`
              : "Sensor stream paused",
      }));
    const verdict =
      events.length === 0
        ? "Nothing detected — this trace does not qualify as stillness or a strong jolt."
        : `Would raise a Lifeline alarm from ${events[0].type === "stillness" ? "stillness" : "a possible impact"}. Test mode did not open an alarm or message anyone.`;
    const lastTest: MovementTestResult = { kind, events, verdict };
    this.publish({ lastTest });
    return lastTest;
  }

  /* ---------------- sample handling ---------------- */

  handleSample(sample: MotionSample) {
    if (!this.state.running || this.state.paused) return;
    if (![sample.x, sample.y, sample.z].every(Number.isFinite)) return;
    this.lastSampleAt = sample.t;
    if (this.state.phase !== "active") this.publish({ phase: "active", reason: null });

    const magnitude = Math.hypot(sample.x, sample.y, sample.z);
    const fallEvent = this.fall(magnitude, sample.t);
    if (fallEvent) this.handleFall(fallEvent, sample.t);

    const movementEvent = this.monitor.feed(sample);
    if (movementEvent) this.handleMovement(movementEvent);
  }

  private handleFall(event: FallEvent, at: number) {
    if (event.type === "impact") {
      this.fallCheckUntil = at + INACTIVITY_MS;
      this.log(`Impact ${(event.peak / 9.80665).toFixed(1)} g · checking for movement`);
      return;
    }
    if (event.type === "recovered") {
      this.log("Impact followed by movement · no fall alarm");
      return;
    }
    if (event.type === "fall") {
      this.report("fall", at, `impact ${(event.peak / 9.80665).toFixed(1)} g, then no movement for 10 s`);
    }
  }

  private handleMovement(event: MovementEvent) {
    if (event.type === "gap") {
      this.log(`Motion stream paused for ${Math.round(event.gapMs / 1000)} s · stillness timer reset`);
      return;
    }
    if (event.type === "stillness") {
      this.report("stillness", event.at, `no movement for ${Math.round(event.stillMs / 1000)} s`);
      return;
    }
    // The fall detector already owns this impact; a jolt alarm on top of it
    // would be the same event twice.
    if (event.at < this.fallCheckUntil) return;
    this.report(
      "jolt",
      event.at,
      `${event.peakG.toFixed(1)} g jolt (${Math.round(event.peakMs2)} m/s² above gravity)`,
    );
  }

  private report(source: MovementEventSource, at: number, detail: string) {
    const reason: AlarmReason =
      source === "stillness"
        ? {
            type: "stillness",
            label: "No movement for 60 seconds",
            reading: detail,
          }
        : source === "jolt"
          ? { type: "jolt", label: "Possible impact", reading: detail }
          : { type: "fall", label: "Fall pattern detected", reading: detail };
    const alarmOpened = this.deps.alarmIdle() ? this.deps.raise(reason) : false;
    this.log(
      `${reason.label} · ${detail}${alarmOpened ? "" : " · an alarm was already open, so no second alarm was raised"}`,
    );
    this.publish({
      lastEvent: { source, at: Date.now(), detail, alarmOpened },
    });
  }

  /* ---------------- availability ---------------- */

  refreshAvailability() {
    const { phase, reason } = movementAvailability({
      supported: this.state.supported,
      secureContext: this.state.secureContext,
      permission: this.state.permission,
      running: this.state.running,
      paused: this.state.paused,
      lastSampleAt: this.lastSampleAt,
      now: this.deps.now(),
      hidden: typeof document !== "undefined" ? document.hidden : false,
      staleMs: STALE_STREAM_MS,
    });
    if (phase !== this.state.phase || reason !== this.state.reason) this.publish({ phase, reason });
  }

  private log(text: string) {
    this.deps.log(text);
  }
}

/** One instance for the whole app, mounted by `MovementMonitorRunner`. */
export const movementRuntime = new MovementMonitorRuntime();

/** Convenience for the card: numeric view of the engine without extra state. */
export function movementEngineView(runtime: MovementMonitorRuntime) {
  const snapshot = runtime.snapshot();
  return {
    ...snapshot,
    stillSeconds: snapshot.stillMs / 1000,
    remainingStillSeconds: Math.max(
      0,
      (MOVEMENT_THRESHOLDS.stillnessMs - snapshot.stillMs) / 1000,
    ),
  };
}
