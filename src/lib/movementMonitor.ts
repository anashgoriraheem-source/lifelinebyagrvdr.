/**
 * Stillness and strong-jolt detection from a phone motion stream
 * (`DeviceMotionEvent.accelerationIncludingGravity`, m/s², gravity included).
 *
 * Two rules, both fed by the same samples as `createFallDetector`:
 *
 *  1. STILLNESS — 60 continuous seconds with almost no *linear* acceleration.
 *     Gravity is removed with a slow low-pass filter, so a phone resting on a
 *     table, held still, or lying on a bed all read as still regardless of the
 *     direction it faces. A single sample above the stillness threshold starts
 *     the window again from zero. A stalled stream is a gap, never stillness.
 *  2. STRONG JOLT — a single spike far above gravity that also arrives fast
 *     (high jerk). Sustained vigorous movement (walking, running) is rejected
 *     by the mean of the seconds before the spike, and a slow rise (putting a
 *     phone down, pressing it against something) is rejected by the jerk test.
 *     A jolt is debounced so one impact cannot raise repeated alarms.
 *
 * This file is pure: no browser APIs, no alarms, no dispatch. The runtime in
 * `movementRuntime.ts` owns the event listener, permissions and the alarm, and
 * test mode replays `buildTrace()` through the same engine.
 */

export const GRAVITY = 9.80665;

/** One accelerometer sample, gravity included, on any monotonic clock. */
export interface MotionSample {
  x: number;
  y: number;
  z: number;
  /** Milliseconds on a monotonic clock (performance.now() in the app). */
  t: number;
}

export interface MovementThresholds {
  /** Linear acceleration (m/s²) at or below which the device counts as still. */
  stillDynamicMs2: number;
  /** Continuous stillness required before the alarm (60 s). */
  stillnessMs: number;
  /** A silence longer than this means the stream stopped: never stillness. */
  sampleGapMs: number;
  /** Spike height above gravity required for a strong jolt (≈2.75 g). */
  joltDynamicMs2: number;
  /** How fast the spike must arrive, m/s³. Rejects slow presses and set-downs. */
  joltJerkMs3: number;
  /** Mean linear acceleration over the preceding second that marks "moving". */
  movingMeanMs2: number;
  /** Samples used for that judgement, and how far back they reach. */
  joltWindowMs: number;
  /** One impact must not raise a second alarm inside this window. */
  joltDebounceMs: number;
  /** Samples needed before readiness is reported. */
  calibrateSamples: number;
}

/**
 * Starting thresholds. Chosen conservatively from recorded traces of a phone at
 * rest (~0.05 m/s² dynamic), walking (3–10 m/s² sustained), a deliberate tap
 * (10–20 m/s² over ≥300 ms) and a hard knock or drop (>30 m/s² within 50 ms).
 * They are calibrated to the phone-in-pocket case and must be re-tested on a
 * real device before anyone relies on them — see AGENTS.md.
 */
export const MOVEMENT_THRESHOLDS: MovementThresholds = {
  stillDynamicMs2: 0.5,
  stillnessMs: 60_000,
  sampleGapMs: 1_500,
  joltDynamicMs2: 27,
  joltJerkMs3: 150,
  movingMeanMs2: 5.5,
  joltWindowMs: 2_000,
  joltDebounceMs: 8_000,
  calibrateSamples: 20,
};

export type MovementEvent =
  | { type: "stillness"; at: number; stillMs: number }
  | { type: "jolt"; at: number; peakMs2: number; peakG: number }
  | { type: "gap"; at: number; gapMs: number };

export type JoltRejection = "debounced" | "sustained-motion" | "gradual" | null;

export interface MovementSnapshot {
  calibrated: boolean;
  samples: number;
  /** Linear acceleration of the last sample, gravity removed. */
  dynamicMs2: number | null;
  gravityMs2: number | null;
  /** Continuous stillness so far, 0 after any movement or gap. */
  stillMs: number;
  lastSampleAt: number | null;
  lastEventAt: number | null;
  lastEventType: "stillness" | "jolt" | null;
  lastJoltRejection: JoltRejection;
}

export interface MovementMonitor {
  feed(sample: MotionSample): MovementEvent | null;
  snapshot(): MovementSnapshot;
  reset(): void;
}

const GRAVITY_TAU_MS = 600;

export function createMovementMonitor(overrides: Partial<MovementThresholds> = {}): MovementMonitor {
  const cfg: MovementThresholds = { ...MOVEMENT_THRESHOLDS, ...overrides };

  let gx = 0;
  let gy = 0;
  let gz = 0;
  let haveGravity = false;
  let prevDynamic: number | null = null;
  let prevT: number | null = null;
  let samples = 0;
  let stillSince: number | null = null;
  let stillnessFired = false;
  let lastJoltAt: number | null = null;
  let lastEventAt: number | null = null;
  let lastEventType: "stillness" | "jolt" | null = null;
  let lastJoltRejection: JoltRejection = null;
  let dynamic: number | null = null;
  let window: { t: number; d: number }[] = [];

  function reset() {
    haveGravity = false;
    prevDynamic = null;
    prevT = null;
    samples = 0;
    stillSince = null;
    stillnessFired = false;
    lastJoltAt = null;
    lastEventAt = null;
    lastEventType = null;
    lastJoltRejection = null;
    dynamic = null;
    window = [];
  }

  function snapshot(): MovementSnapshot {
    const gravityMs2 = haveGravity ? Math.hypot(gx, gy, gz) : null;
    return {
      calibrated:
        samples >= cfg.calibrateSamples && gravityMs2 != null && Math.abs(gravityMs2 - GRAVITY) < 2.5,
      samples,
      dynamicMs2: dynamic,
      gravityMs2,
      stillMs: stillSince != null && prevT != null ? Math.max(0, prevT - stillSince) : 0,
      lastSampleAt: prevT,
      lastEventAt,
      lastEventType,
      lastJoltRejection,
    };
  }

  function feed(sample: MotionSample): MovementEvent | null {
    const { x, y, z, t } = sample;
    if (![x, y, z, t].every(Number.isFinite)) return null;
    if (prevT != null && t < prevT) return null; // out-of-order sample: ignore
    const dt = prevT == null ? 0 : t - prevT;

    // A stalled stream means the sensor stopped: this is "monitoring
    // unavailable", so the stillness window must not carry over the gap.
    if (prevT != null && dt > cfg.sampleGapMs) {
      reset();
      haveGravity = true;
      gx = x;
      gy = y;
      gz = z;
      prevT = t;
      prevDynamic = Math.hypot(x - gx, y - gy, z - gz);
      dynamic = prevDynamic;
      lastEventAt = t;
      lastEventType = null;
      return { type: "gap", at: t, gapMs: dt };
    }

    // Gravity follows the device's orientation slowly, so a rotation is not a
    // jolt and a phone facing any direction still measures its own stillness.
    const alpha = haveGravity && dt > 0 ? 1 - Math.exp(-dt / GRAVITY_TAU_MS) : 1;
    if (!haveGravity) {
      gx = x;
      gy = y;
      gz = z;
      haveGravity = true;
    } else {
      gx += (x - gx) * alpha;
      gy += (y - gy) * alpha;
      gz += (z - gz) * alpha;
    }

    dynamic = Math.hypot(x - gx, y - gy, z - gz);
    const jerk = prevDynamic != null && dt > 0 ? Math.abs(dynamic - prevDynamic) / (dt / 1000) : 0;
    prevDynamic = dynamic;
    prevT = t;
    samples++;
    window.push({ t, d: dynamic });
    while (window.length && t - window[0].t > cfg.joltWindowMs) window.shift();

    // --- stillness -----------------------------------------------------
    if (dynamic <= cfg.stillDynamicMs2) {
      stillSince ??= t;
      const stillMs = t - stillSince;
      if (!stillnessFired && stillMs >= cfg.stillnessMs) {
        stillnessFired = true;
        lastEventAt = t;
        lastEventType = "stillness";
        lastJoltRejection = null;
        return { type: "stillness", at: t, stillMs };
      }
    } else {
      stillSince = null;
      stillnessFired = false;
    }

    // --- strong jolt ---------------------------------------------------
    if (dynamic < cfg.joltDynamicMs2) return null;

    if (lastJoltAt != null && t - lastJoltAt < cfg.joltDebounceMs) {
      lastJoltRejection = "debounced";
      return null;
    }
    // Mean of the samples before the spike: walking and running carry a high
    // baseline, an isolated knock does not.
    const before = window.filter((s) => t - s.t >= 500);
    const beforeMean = before.length
      ? before.reduce((sum, s) => sum + s.d, 0) / before.length
      : 0;
    if (before.length >= 8 && beforeMean >= cfg.movingMeanMs2) {
      lastJoltRejection = "sustained-motion";
      return null;
    }
    if (jerk < cfg.joltJerkMs3) {
      lastJoltRejection = "gradual";
      return null;
    }
    lastJoltAt = t;
    lastEventAt = t;
    lastEventType = "jolt";
    lastJoltRejection = null;
    return { type: "jolt", at: t, peakMs2: dynamic, peakG: dynamic / GRAVITY };
  }

  return { feed, snapshot, reset };
}

/* ------------------------------------------------------------------ *
 * Monitoring availability
 * ------------------------------------------------------------------ */

export type MovementPermission = "unknown" | "granted" | "denied" | "unsupported";

export type MovementPhase = "idle" | "starting" | "active" | "paused" | "unavailable";

export type MovementUnavailableReason =
  | "unsupported"
  | "insecure-context"
  | "permission-denied"
  | "permission-missing"
  | "no-stream"
  | "stale-stream"
  | "background";

/**
 * Turns the browser facts into one honest monitoring state. Anything other than
 * a fresh, permitted stream is reported as unavailable — never as "monitoring".
 */
export function movementAvailability(input: {
  supported: boolean;
  secureContext: boolean;
  permission: MovementPermission;
  running: boolean;
  paused: boolean;
  lastSampleAt: number | null;
  now: number;
  hidden: boolean;
  staleMs?: number;
}): { phase: MovementPhase; reason: MovementUnavailableReason | null } {
  const staleMs = input.staleMs ?? 3_000;
  if (!input.supported) return { phase: "unavailable", reason: "unsupported" };
  if (!input.secureContext) return { phase: "unavailable", reason: "insecure-context" };
  if (input.permission === "denied") return { phase: "unavailable", reason: "permission-denied" };
  if (input.permission !== "granted")
    return { phase: "unavailable", reason: "permission-missing" };
  if (!input.running) return { phase: "idle", reason: null };
  if (input.paused) return { phase: "paused", reason: null };
  // A page in the background is not monitored: browsers pause or throttle the
  // sensor, and this web app has no background service to fall back on.
  if (input.hidden) return { phase: "unavailable", reason: "background" };
  if (input.lastSampleAt == null) return { phase: "unavailable", reason: "no-stream" };
  if (input.now - input.lastSampleAt > staleMs)
    return { phase: "unavailable", reason: "stale-stream" };
  return { phase: "active", reason: null };
}

export const UNAVAILABLE_COPY: Record<MovementUnavailableReason, string> = {
  unsupported:
    "This browser does not expose a motion sensor. On iPhone, motion sensors are only available in Safari (not in other browsers or in an in-app viewer).",
  "insecure-context":
    "Motion data is only available on a secure https:// page. Open Lifeline over https to use this monitor.",
  "permission-denied":
    "Motion access is blocked for this site. Allow Motion & Orientation in your browser's site settings, then start monitoring again.",
  "permission-missing":
    "Lifeline has not been given motion access yet. Press Start monitoring to ask for it.",
  "no-stream":
    "No motion readings have arrived yet. Keep this page open and move the phone slightly.",
  "stale-stream":
    "The motion stream stopped. Lifeline cannot confirm movement, so monitoring is unavailable — start it again, or keep this page open on the device.",
  background:
    "This page is not in the foreground, so the sensor stream is paused and monitoring is unavailable. Lifeline does not monitor in the background.",
};

/* ------------------------------------------------------------------ *
 * Test mode: synthetic traces through the real engine
 * ------------------------------------------------------------------ */

export type TraceKind = "stillness" | "jolt" | "walking" | "rotation" | "set-down";

export const TRACE_LABEL: Record<TraceKind, string> = {
  stillness: "60 s lying still",
  jolt: "Single hard knock",
  walking: "Walking (with a stumble)",
  rotation: "Turning the phone in the hand",
  "set-down": "Putting the phone on a table",
};

const STEP_MS = 50;

function noiseSource(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function sampleAt(t: number, ax: number, ay: number, az: number, rand: () => number): MotionSample {
  const jitter = () => (rand() - 0.5) * 0.12;
  return { x: ax + jitter(), y: ay + jitter(), z: az + jitter(), t };
}

/**
 * Synthetic accelerometer traces used by test mode and the detector tests.
 * They contain no real person's data and never reach the alarm or the provider.
 */
export function buildTrace(kind: TraceKind): MotionSample[] {
  const rand = noiseSource(kind.length * 7919 + 17);
  const out: MotionSample[] = [];
  const push = (ax: number, ay: number, az: number) =>
    out.push(sampleAt(out.length * STEP_MS, ax, ay, az, rand));

  if (kind === "stillness") {
    for (let i = 0; i < 63_000 / STEP_MS; i++) push(0, 0, GRAVITY);
    return out;
  }

  if (kind === "jolt") {
    for (let i = 0; i < 4_000 / STEP_MS; i++) push(0, 0, GRAVITY);
    for (const extra of [10, 26, 44, 30, 12, 4]) push(0, 0, GRAVITY + extra);
    for (let i = 0; i < 4_000 / STEP_MS; i++) push(0, 0, GRAVITY);
    return out;
  }

  if (kind === "walking") {
    // Sustained 4–12 m/s² oscillation with one larger stumble at 10 s.
    for (let i = 0; i < 20_000 / STEP_MS; i++) {
      const t = i * STEP_MS;
      const stride = 8 + 4 * Math.sin((2 * Math.PI * t) / 600);
      const stumble = t >= 10_000 && t < 10_150 ? 22 : 0;
      push(0, 0, GRAVITY + stride + stumble);
    }
    return out;
  }

  if (kind === "rotation") {
    // The phone turns 180° over 6 s: the gravity vector moves between axes but
    // its magnitude does not change.
    for (let i = 0; i < 12_000 / STEP_MS; i++) {
      const angle = (Math.PI * Math.min(i * STEP_MS, 6_000)) / 6_000;
      push(GRAVITY * Math.sin(angle), 0, GRAVITY * Math.cos(angle));
    }
    return out;
  }

  // set-down: a slow, firm push onto a surface, then removed slowly again.
  for (let i = 0; i < 4_000 / STEP_MS; i++) push(0, 0, GRAVITY);
  for (let i = 0; i <= 24; i++) push(0, 0, GRAVITY + (30 * i) / 24);
  for (let i = 0; i <= 12; i++) push(0, 0, GRAVITY + 30 - (30 * i) / 12);
  for (let i = 0; i < 4_000 / STEP_MS; i++) push(0, 0, GRAVITY);
  return out;
}

/** Replays a built-in trace through the real engine. Pure — nothing is sent. */
export function runTrace(
  kind: TraceKind,
  overrides: Partial<MovementThresholds> = {},
): { kind: TraceKind; events: MovementEvent[]; snapshot: MovementSnapshot } {
  const monitor = createMovementMonitor(overrides);
  const events: MovementEvent[] = [];
  for (const sample of buildTrace(kind)) {
    const event = monitor.feed(sample);
    if (event) events.push(event);
  }
  return { kind, events, snapshot: monitor.snapshot() };
}
