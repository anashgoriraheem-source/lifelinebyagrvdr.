import { describe, expect, it } from "vitest";
import {
  NO_MEASUREMENT_MS,
  connectionPhase,
  freshVitals,
  latestReadingAt,
  missingServices,
  plausibleReading,
  validMeasurementTime,
  waitingWithoutMeasurement,
} from "./support";
import type { Reading } from "@/lib/types";

const reading = (value: number, receivedAt: number, value2?: number): Reading => ({
  value,
  value2,
  unit: "bpm",
  source: "synthetic fixture",
  measuredAt: receivedAt,
  receivedAt,
  quality: "uncertain",
});

describe("plausibility bounds — input validation, not a clinical range", () => {
  it("accepts ordinary values for every supported vital", () => {
    expect(plausibleReading("hr", 72)).toBe(true);
    expect(plausibleReading("spo2", 97)).toBe(true);
    expect(plausibleReading("bp", 124, 82)).toBe(true);
    expect(plausibleReading("glucose", 112)).toBe(true);
  });

  it("rejects impossible or mis-scaled values instead of displaying them", () => {
    expect(plausibleReading("hr", 0)).toBe(false);
    expect(plausibleReading("hr", 400)).toBe(false);
    expect(plausibleReading("spo2", 40)).toBe(false);
    expect(plausibleReading("spo2", 101)).toBe(false);
    expect(plausibleReading("glucose", 9000)).toBe(false);
  });

  it("rejects a blood pressure without a diastolic, or with the pair reversed", () => {
    expect(plausibleReading("bp", 120)).toBe(false);
    expect(plausibleReading("bp", 80, 120)).toBe(false);
  });
});

describe("device freshness", () => {
  const now = 1_000_000_000_000;

  it("counts a recent heart rate as live and an old one as stale", () => {
    expect(freshVitals({ hr: reading(72, now - 1_000) }, now)).toEqual(["hr"]);
    expect(freshVitals({ hr: reading(72, now - 120_000) }, now)).toEqual([]);
  });

  it("reports the newest received time across vitals", () => {
    expect(latestReadingAt({ hr: reading(72, now - 5_000), spo2: reading(97, now - 1_000) })).toBe(
      now - 1_000,
    );
    expect(latestReadingAt({})).toBeNull();
  });
});

describe("connection phase — a connection is not a measurement", () => {
  const now = 1_000_000_000_000;

  it("separates connecting, connected-without-a-reading, receiving and stale", () => {
    expect(connectionPhase({ device: { status: "connecting" }, vitals: {}, now })).toBe(
      "connecting",
    );
    expect(connectionPhase({ device: { status: "connected" }, vitals: {}, now })).toBe("connected");
    expect(
      connectionPhase({ device: { status: "connected" }, vitals: { hr: reading(72, now) }, now }),
    ).toBe("receiving");
    expect(
      connectionPhase({
        device: { status: "connected" },
        vitals: { hr: reading(72, now - 300_000) },
        now,
      }),
    ).toBe("stale");
  });

  it("reports an automatic reconnect as its own state", () => {
    expect(connectionPhase({ device: { status: "reconnecting" }, vitals: {}, now })).toBe(
      "reconnecting",
    );
  });

  it("keeps loss, error and browser support distinct", () => {
    expect(connectionPhase({ device: { status: "disconnected" }, vitals: {}, now })).toBe(
      "disconnected",
    );
    expect(connectionPhase({ device: { status: "error" }, vitals: {}, now })).toBe("error");
    expect(connectionPhase({ device: { status: "idle" }, vitals: {}, now })).toBe("idle");
    expect(
      connectionPhase({ device: { status: "connected" }, vitals: {}, now, supported: false }),
    ).toBe("unsupported");
  });

  it("flags a long wait with no measurement, but stops once one arrives", () => {
    const connectedAt = now - NO_MEASUREMENT_MS - 1;
    expect(waitingWithoutMeasurement({ status: "connected", connectedAt }, {}, now)).toBe(true);
    expect(
      waitingWithoutMeasurement(
        { status: "connected", connectedAt },
        { hr: reading(72, now) },
        now,
      ),
    ).toBe(false);
    expect(waitingWithoutMeasurement({ status: "disconnected", connectedAt }, {}, now)).toBe(false);
  });

  it("lists supported services a connection did not expose", () => {
    expect(missingServices(["hr"])).toEqual(["spo2", "bp", "glucose"]);
  });
});

describe("device clock trust", () => {
  const now = Date.now();
  it("accepts a recent measurement time and rejects future or very old ones", () => {
    expect(validMeasurementTime(now - 60_000, now)).toBe(true);
    expect(validMeasurementTime(now + 60 * 60_000, now)).toBe(false);
    expect(validMeasurementTime(now - 30 * 24 * 60 * 60_000, now)).toBe(false);
  });
});
