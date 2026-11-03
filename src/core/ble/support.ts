/**
 * Pure helpers for the Bluetooth reading flow: plausibility limits, freshness
 * and the connection phase the UI shows. No browser APIs here, so the rules
 * that decide "connected vs receiving vs stale" are testable without hardware.
 */
import { isStale } from "@/lib/detection";
import type { DeviceState } from "@/lib/store";
import type { Reading, VitalKey } from "@/lib/types";
import { VITAL_KEYS } from "@/lib/readingDays";

/**
 * Physiological plausibility bounds. A value outside these is treated as a
 * malformed or mis-scaled packet, never displayed. They are input validation,
 * not clinical normal ranges, and they do not replace the user's own limits.
 */
export const PLAUSIBLE: Record<
  VitalKey,
  { min: number; max: number; secondMin?: number; secondMax?: number }
> = {
  hr: { min: 20, max: 260 },
  spo2: { min: 50, max: 100 },
  bp: { min: 40, max: 300, secondMin: 20, secondMax: 200 },
  glucose: { min: 20, max: 800 },
};

export function plausibleReading(key: VitalKey, value: number, value2?: number): boolean {
  const bounds = PLAUSIBLE[key];
  if (!Number.isFinite(value) || value < bounds.min || value > bounds.max) return false;
  if (bounds.secondMin != null) {
    if (value2 == null || !Number.isFinite(value2)) return false;
    if (value2 < bounds.secondMin || value2 > (bounds.secondMax ?? bounds.max)) return false;
    // Systolic must be above diastolic; a reversed pair is a decoding error.
    if (value <= value2) return false;
  }
  return true;
}

/**
 * A device clock is only trusted when the measurement is recent and not in the
 * future. Older packets (a device replaying its history) keep the arrival time.
 */
export function validMeasurementTime(at: number, now = Date.now()) {
  const WEEK = 7 * 24 * 60 * 60_000;
  return Number.isFinite(at) && at <= now + 10 * 60_000 && now - at <= WEEK;
}

/** Vitals with a reading inside their freshness window right now. */
export function freshVitals(
  vitals: Partial<Record<VitalKey, Reading>>,
  now = Date.now(),
): VitalKey[] {
  return VITAL_KEYS.filter((k) => vitals[k] && !isStale(k, vitals[k], now));
}

/** Newest measurement time across the current readings, or null. */
export function latestReadingAt(vitals: Partial<Record<VitalKey, Reading>>): number | null {
  let latest: number | null = null;
  for (const k of VITAL_KEYS) {
    const at = vitals[k]?.receivedAt;
    if (at != null && (latest == null || at > latest)) latest = at;
  }
  return latest;
}

/** After this long connected with nothing received, the UI explains what to try. */
export const NO_MEASUREMENT_MS = 20_000;

export type ConnectionPhase =
  | "unsupported"
  | "idle"
  | "connecting"
  | "connected"
  | "receiving"
  | "stale"
  | "disconnected"
  | "error";

/**
 * The single answer to "what is happening with the device right now".
 *
 * `connected` deliberately means GATT is up but no measurement has arrived:
 * a connection is not a reading, so it must never be shown as monitoring.
 * `stale` means readings arrived but none is inside its freshness window.
 */
export function connectionPhase({
  device,
  vitals,
  now = Date.now(),
  supported = true,
}: {
  device: Pick<DeviceState, "status">;
  vitals: Partial<Record<VitalKey, Reading>>;
  now?: number;
  supported?: boolean;
}): ConnectionPhase {
  if (!supported) return "unsupported";
  if (device.status === "connecting") return "connecting";
  if (device.status === "error") return "error";
  if (device.status === "disconnected") return "disconnected";
  if (device.status === "idle") return "idle";
  if (freshVitals(vitals, now).length) return "receiving";
  return latestReadingAt(vitals) == null ? "connected" : "stale";
}

/** True while connected with no measurement yet and the wait has gone on too long. */
export function waitingWithoutMeasurement(
  device: Pick<DeviceState, "status" | "connectedAt">,
  vitals: Partial<Record<VitalKey, Reading>>,
  now = Date.now(),
  timeoutMs = NO_MEASUREMENT_MS,
) {
  if (device.status !== "connected" || device.connectedAt == null) return false;
  if (latestReadingAt(vitals) != null) return false;
  return now - device.connectedAt >= timeoutMs;
}

/** Which supported service families a connection actually exposed, in monitor order. */
const MONITOR_ORDER: VitalKey[] = ["hr", "spo2", "bp", "glucose"];
export function missingServices(found: VitalKey[]): VitalKey[] {
  return MONITOR_ORDER.filter((k) => !found.includes(k));
}
