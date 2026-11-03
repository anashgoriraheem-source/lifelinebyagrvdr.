import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GRAVITY,
  MOVEMENT_THRESHOLDS,
  buildTrace,
  createMovementMonitor,
  movementAvailability,
  runTrace,
  type MotionSample,
} from "./movementMonitor";

/** Feeds `durationMs` of a phone lying still, starting at `from`. */
function feedStill(monitor: ReturnType<typeof createMovementMonitor>, from: number, durationMs: number) {
  const events = [];
  for (let t = from; t <= from + durationMs; t += 50) {
    const event = monitor.feed({ x: 0, y: 0, z: GRAVITY, t });
    if (event) events.push(event);
  }
  return { events, end: from + durationMs };
}

describe("stillness detection", () => {
  it("raises exactly once at 60 seconds of continuous stillness", () => {
    const monitor = createMovementMonitor();
    const { events } = feedStill(monitor, 0, 63_000);
    const stillness = events.filter((e) => e.type === "stillness");
    expect(stillness).toHaveLength(1);
    expect(stillness[0].type === "stillness" && stillness[0].at).toBe(MOVEMENT_THRESHOLDS.stillnessMs);
  });

  it("does not raise a moment before 60 seconds", () => {
    const monitor = createMovementMonitor();
    const { events } = feedStill(monitor, 0, 59_000);
    expect(events).toHaveLength(0);
    expect(monitor.snapshot().stillMs).toBeGreaterThan(58_000);
    expect(monitor.snapshot().stillMs).toBeLessThan(MOVEMENT_THRESHOLDS.stillnessMs);
  });

  it("restarts the window when movement resumes", () => {
    const monitor = createMovementMonitor();
    const first = feedStill(monitor, 0, 40_000);
    expect(first.events).toHaveLength(0);
    // One real movement sample clears the episode.
    expect(monitor.feed({ x: 0, y: 4, z: GRAVITY, t: 40_050 })).toBeNull();
    expect(monitor.snapshot().stillMs).toBe(0);
    const second = feedStill(monitor, 40_100, 59_000);
    expect(second.events).toHaveLength(0);
    const third = feedStill(monitor, 99_100, 2_000);
    const stillness = [...second.events, ...third.events].filter((e) => e.type === "stillness");
    expect(stillness).toHaveLength(1);
    // 40 100 → 100 100 is the 60 s of stillness that follows the movement.
    expect(stillness[0].type === "stillness" && stillness[0].at).toBe(100_100);
  });

  it("treats a sensor gap as unavailable, never as stillness", () => {
    const monitor = createMovementMonitor();
    const before = feedStill(monitor, 0, 40_000);
    expect(before.events).toHaveLength(0);
    // The stream stops for 10 s, then resumes: the timer must start again.
    const gapEvent = monitor.feed({ x: 0, y: 0, z: GRAVITY, t: 50_000 });
    expect(gapEvent?.type).toBe("gap");
    expect(monitor.snapshot().stillMs).toBe(0);
    const after = feedStill(monitor, 50_050, 59_000);
    expect([...before.events, ...after.events].filter((e) => e.type === "stillness")).toHaveLength(0);
    const finish = feedStill(monitor, 109_050, 2_000);
    const stillness = finish.events.filter((e) => e.type === "stillness");
    expect(stillness).toHaveLength(1);
    expect(stillness[0].type === "stillness" && stillness[0].at).toBe(110_050);
  });

  it("ignores malformed and out-of-order samples instead of guessing", () => {
    const monitor = createMovementMonitor();
    expect(monitor.feed({ x: Number.NaN, y: 0, z: 0, t: 0 })).toBeNull();
    monitor.feed({ x: 0, y: 0, z: GRAVITY, t: 1_000 });
    expect(monitor.feed({ x: 0, y: 0, z: GRAVITY, t: 900 })).toBeNull();
    expect(monitor.snapshot().samples).toBe(1);
  });
});

describe("strong jolt detection", () => {
  it("raises one jolt for a single hard knock", () => {
    const result = runTrace("jolt");
    const jolts = result.events.filter((e) => e.type === "jolt");
    expect(jolts).toHaveLength(1);
    expect(jolts[0].type === "jolt" && jolts[0].peakG).toBeGreaterThan(2.5);
  });

  it("debounces a second impact inside the debounce window", () => {
    const monitor = createMovementMonitor();
    const feedSpike = (from: number) => {
      const events = [];
      for (let t = from; t < from + 400; t += 50) {
        const boost = t === from || t === from + 50 ? 45 : 0;
        const event = monitor.feed({ x: 0, y: 0, z: GRAVITY + boost, t });
        if (event) events.push(event);
      }
      return events;
    };
    expect(feedSpike(2_000).filter((e) => e.type === "jolt")).toHaveLength(1);
    // 1 s later: still inside MOVEMENT_THRESHOLDS.joltDebounceMs.
    expect(feedSpike(3_400).filter((e) => e.type === "jolt")).toHaveLength(0);
    expect(monitor.snapshot().lastJoltRejection).toBe("debounced");
  });

  it("rejects walking, even with a stumble", () => {
    const result = runTrace("walking");
    expect(result.events.filter((e) => e.type === "jolt")).toHaveLength(0);
  });

  it("does not treat turning the phone or putting it down as an impact", () => {
    expect(runTrace("rotation").events.filter((e) => e.type === "jolt")).toHaveLength(0);
    expect(runTrace("set-down").events.filter((e) => e.type === "jolt")).toHaveLength(0);
  });

  it("never reports stillness from a moving trace", () => {
    expect(runTrace("walking").events.filter((e) => e.type === "stillness")).toHaveLength(0);
  });
});

describe("monitoring availability", () => {
  const base = {
    supported: true,
    secureContext: true,
    permission: "granted" as const,
    running: true,
    paused: false,
    lastSampleAt: 1_000,
    now: 2_000,
    hidden: false,
  };

  it("reports active only with a fresh permitted stream", () => {
    expect(movementAvailability(base)).toEqual({ phase: "active", reason: null });
  });

  it("reports unsupported hardware, insecure pages and a denied permission", () => {
    expect(movementAvailability({ ...base, supported: false })).toEqual({
      phase: "unavailable",
      reason: "unsupported",
    });
    expect(movementAvailability({ ...base, secureContext: false })).toEqual({
      phase: "unavailable",
      reason: "insecure-context",
    });
    expect(movementAvailability({ ...base, permission: "denied" })).toEqual({
      phase: "unavailable",
      reason: "permission-denied",
    });
    expect(movementAvailability({ ...base, permission: "unknown" })).toEqual({
      phase: "unavailable",
      reason: "permission-missing",
    });
  });

  it("reports a missing or stale stream and a backgrounded page as unavailable", () => {
    expect(movementAvailability({ ...base, lastSampleAt: null })).toEqual({
      phase: "unavailable",
      reason: "no-stream",
    });
    expect(movementAvailability({ ...base, lastSampleAt: 0, now: 10_000 })).toEqual({
      phase: "unavailable",
      reason: "stale-stream",
    });
    expect(movementAvailability({ ...base, hidden: true })).toEqual({
      phase: "unavailable",
      reason: "background",
    });
  });

  it("reports paused and idle distinctly, never as monitoring", () => {
    expect(movementAvailability({ ...base, paused: true })).toEqual({ phase: "paused", reason: null });
    expect(movementAvailability({ ...base, running: false })).toEqual({ phase: "idle", reason: null });
  });
});

describe("alarm integration rules", () => {
  it("announces the source of a movement alarm", async () => {
    const { ALARM_SOURCE_TYPES } = await import("./movementRuntime");
    expect(ALARM_SOURCE_TYPES).toEqual(["stillness", "jolt", "fall"]);
  });

  it("test mode reports what the detector would do and never opens an alarm", async () => {
    const { MovementMonitorRuntime } = await import("./movementRuntime");
    const raised: unknown[] = [];
    const runtime = new MovementMonitorRuntime({
      now: () => 0,
      alarmIdle: () => true,
      demo: () => false,
      log: () => {},
      raise: (reason) => {
        raised.push(reason);
        return true;
      },
    });
    const result = runtime.runTest("stillness");
    expect(result.events).toHaveLength(1);
    expect(result.verdict).toContain("Test mode did not open an alarm");
    expect(raised).toHaveLength(0);
    expect(runtime.runTest("walking").events).toHaveLength(0);
  });

  it("a second event while an alarm is open cannot start another alarm or incident", async () => {
    const { appStore, cancelAlarm, raiseAlarm } = await import("./store");
    const reason = {
      type: "stillness" as const,
      label: "No movement for 60 seconds",
      reading: "no movement for 60 s",
    };
    raiseAlarm(reason, { demo: false });
    const startedAt = appStore.state.alarm.startedAt;
    expect(appStore.state.alarm.phase).not.toBe("idle");
    raiseAlarm({ ...reason, type: "jolt", label: "Possible impact" }, { demo: false });
    expect(appStore.state.alarm.startedAt).toBe(startedAt);
    expect(appStore.state.alarm.reason?.type).toBe("stillness");
    // Acknowledging "I'm OK" clears the alarm; the incident is cancelled by
    // AlertRecorder through the same path every other alarm uses.
    cancelAlarm("Acknowledged — I'm OK");
    expect(appStore.state.alarm.phase).toBe("idle");
  });

  it("test mode is pure: the trace runner imports no alarm, dispatch or provider code", () => {
    const source = readFileSync(resolve(process.cwd(), "src/lib/movementMonitor.ts"), "utf8");
    for (const needle of ["raiseAlarm", "@/lib/store", "@/lib/dispatch", "alertProvider", "fetch("]) {
      expect(source.includes(needle), `movementMonitor.ts must not reference ${needle}`).toBe(false);
    }
    expect(source).toContain("runTrace");
  });

  it("the test-mode card never raises an alarm itself", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/MovementMonitorCard.tsx"),
      "utf8",
    );
    for (const needle of ["raiseAlarm", "dispatchEmergency", "startTestAlert", "tel:", "sms:"]) {
      expect(source.includes(needle), `the monitor card must not call ${needle}`).toBe(false);
    }
    expect(source).toContain("Test only — nothing was sent or called.");
  });

  it("the only demo alarm path is clearly a demo and marked as such", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/MovementDemoTrigger.tsx"),
      "utf8",
    );
    expect(source).toContain("demo: true");
    expect(source).toContain("demo");
    expect(source).toContain("(demo)");
  });
});

describe("trace fixtures", () => {
  it("produces samples on a 50 ms grid with real gravity", () => {
    const trace: MotionSample[] = buildTrace("jolt");
    expect(trace.length).toBeGreaterThan(100);
    expect(trace[0].t).toBe(0);
    expect(trace[1].t - trace[0].t).toBe(50);
    const rest = trace[0];
    expect(Math.hypot(rest.x, rest.y, rest.z)).toBeCloseTo(GRAVITY, 0);
  });
});
