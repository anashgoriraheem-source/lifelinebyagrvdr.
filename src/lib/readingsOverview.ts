/**
 * Monthly readings overview — pure aggregation over the device-local
 * `readingDays` map. It counts only *which supported vitals produced a reading
 * on which day*; no measured values are stored or charted here. Every number in
 * the dashboard comes from this module, so empty months stay empty and nothing
 * is invented.
 */
import type { ReadingDays } from "./readingDays";
import type { VitalKey } from "./types";

/** Display order used by the dashboard (matches the monitor cards). */
export const DISPLAY_ORDER: VitalKey[] = ["hr", "spo2", "bp", "glucose"];

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
export const MONTH_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const pad = (n: number) => String(n).padStart(2, "0");

export interface MonthBucket {
  key: string;
  year: number;
  /** 0-based month index. */
  monthIndex: number;
  /** e.g. `NOV 2026`. */
  label: string;
  /** e.g. `NOV-26` — the short code used as the sheet title. */
  code: string;
  /** Calendar days in the month. */
  days: number;
  /** Days that have already happened (whole month for past months). */
  elapsed: number;
  /** Days with at least one recorded reading. */
  loggedDays: number;
  /** Days on which each vital produced a reading. */
  vitalDays: Record<VitalKey, number>;
  /** Sum of vitalDays — one reading of each vital on one day is one unit. */
  vitalDaysTotal: number;
  /** loggedDays / elapsed, 0–1. */
  coverage: number;
  /** Most recent day with a reading in this month, `YYYY-MM-DD`. */
  lastLogged: string | null;
}

function emptyVitalDays(): Record<VitalKey, number> {
  return { hr: 0, spo2: 0, bp: 0, glucose: 0 };
}

/** The last `count` calendar months, oldest first, ending with the current one. */
export function buildMonthBuckets(
  readingDays: ReadingDays,
  now = Date.now(),
  count = 12,
): MonthBucket[] {
  const today = new Date(now);
  const buckets: MonthBucket[] = [];
  for (let back = count - 1; back >= 0; back--) {
    const first = new Date(today.getFullYear(), today.getMonth() - back, 1);
    const year = first.getFullYear();
    const monthIndex = first.getMonth();
    const days = new Date(year, monthIndex + 1, 0).getDate();
    const current = year === today.getFullYear() && monthIndex === today.getMonth();
    const elapsed = current ? today.getDate() : days;
    const prefix = `${year}-${pad(monthIndex + 1)}`;

    const vitalDays = emptyVitalDays();
    let loggedDays = 0;
    let lastLogged: string | null = null;

    for (const [day, keys] of Object.entries(readingDays)) {
      if (!day.startsWith(prefix)) continue;
      const dayNumber = Number(day.slice(8, 10));
      if (!Number.isFinite(dayNumber) || dayNumber > elapsed) continue;
      loggedDays++;
      for (const key of keys) vitalDays[key] = (vitalDays[key] ?? 0) + 1;
      if (!lastLogged || day > lastLogged) lastLogged = day;
    }

    const vitalDaysTotal = DISPLAY_ORDER.reduce((sum, key) => sum + vitalDays[key], 0);

    buckets.push({
      key: prefix,
      year,
      monthIndex,
      label: `${MONTHS[monthIndex]} ${year}`,
      code: `${MONTHS[monthIndex]}-${String(year).slice(2)}`,
      days,
      elapsed,
      loggedDays,
      vitalDays,
      vitalDaysTotal,
      coverage: elapsed > 0 ? loggedDays / elapsed : 0,
      lastLogged,
    });
  }
  return buckets;
}

/** Month-over-month change in reading days. `null` when there is no baseline. */
export function dayDelta(current: number, previous: number | null): number | null {
  if (previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export interface Slice {
  key: VitalKey;
  days: number;
  /** Share of all recorded vital-days, 0–1. */
  share: number;
}

/** Donut slices for one month, in display order, only for vitals with data. */
export function bucketSlices(bucket: MonthBucket): Slice[] {
  if (!bucket.vitalDaysTotal) return [];
  return DISPLAY_ORDER.filter((key) => bucket.vitalDays[key] > 0).map((key) => ({
    key,
    days: bucket.vitalDays[key],
    share: bucket.vitalDays[key] / bucket.vitalDaysTotal,
  }));
}

/**
 * Cumulative `stroke-dasharray` / `stroke-dashoffset` pairs for an SVG ring whose
 * circumference is normalised to 100 (the r=15.915 ring in a 42×42 viewBox).
 */
export function sliceDashes(slices: Slice[]) {
  let cumulative = 0;
  return slices.map((slice) => {
    const pct = slice.share * 100;
    const dash = { pct, dashArray: `${pct} ${100 - pct}`, dashOffset: -cumulative };
    cumulative += pct;
    return dash;
  });
}

/** Days in a month that produced no reading, for the honest empty label. */
export function missingDays(bucket: MonthBucket) {
  return Math.max(0, bucket.elapsed - bucket.loggedDays);
}

/**
 * A dense set of x/y points tracing the 12-month reading-day curve. Catmull-Rom
 * keeps the interpolated line smooth through every month; troughs stay above the
 * floor so a zero month is still visible as a line tip.
 */
export function ridgePoints(values: number[], samples = 97) {
  const max = Math.max(1, ...values);
  const y = (v: number) => 100 - (0.18 + (v / max) * 0.72) * 100;
  if (values.length === 0) return [];
  if (values.length === 1) return [{ x: 0, y: y(values[0]) }];
  const cr = (p0: number, p1: number, p2: number, p3: number, t: number) => {
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      0.5 *
      (2 * p1 +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
    );
  };
  const sample = (pos: number) => {
    const i = Math.min(Math.max(0, Math.floor(pos)), values.length - 2);
    return cr(
      values[Math.max(0, i - 1)],
      values[i],
      values[i + 1],
      values[Math.min(values.length - 1, i + 2)],
      pos - i,
    );
  };
  return Array.from({ length: samples }, (_, s) => {
    const x = (s / (samples - 1)) * 100;
    return { x, y: y(sample((s / (samples - 1)) * (values.length - 1))) };
  });
}

/** x/y of each month on the ridgeline, for the accent mark. */
export function ridgeMarkers(values: number[]) {
  const max = Math.max(1, ...values);
  const y = (v: number) => 100 - (0.18 + (v / max) * 0.72) * 100;
  const last = Math.max(1, values.length - 1);
  return values.map((v, i) => ({ x: (i / last) * 100, y: y(v) }));
}

export { dayKey } from "./readingDays";
