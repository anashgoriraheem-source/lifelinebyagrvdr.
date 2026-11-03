/**
 * Pure helpers for the "reading days by month" disc chart.
 *
 * The chart plots the share of each month's elapsed days that had at least one
 * recorded reading, taken from the device-local `readingDays` record (which
 * stores *which* vitals were seen, never a measured value). Keeping the maths
 * here means the proportions and the average can be checked without a browser.
 */
import { MONTH_LONG, buildMonthBuckets } from "./readingsOverview";
import type { ReadingDays } from "./readingDays";

/** The chart's fixed row count — one disc per month. */
export const MONTH_ROWS = 5;

const SHORT = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

export interface MonthRow {
  key: string;
  short: string;
  long: string;
  /** Percentage of elapsed days with a reading, 0–100. */
  value: number;
  loggedDays: number;
  elapsed: number;
}

export function monthRows(
  readingDays: ReadingDays,
  now = Date.now(),
  rows = MONTH_ROWS,
): MonthRow[] {
  return buildMonthBuckets(readingDays, now, rows).map((bucket) => ({
    key: bucket.key,
    short: SHORT[bucket.monthIndex],
    long: `${MONTH_LONG[bucket.monthIndex]} ${bucket.year}`,
    value: Math.round(bucket.coverage * 100),
    loggedDays: bucket.loggedDays,
    elapsed: bucket.elapsed,
  }));
}

/**
 * Disc width as a percentage of the ring, relative to the largest value, so the
 * ovals stay comparable. A month with no reading keeps a small marker instead of
 * disappearing altogether; its score still reads 0.
 */
export function discWidth(value: number, max: number): number {
  if (!(value > 0)) return 12;
  return Math.max(8, (value / Math.max(1, max)) * 100);
}

/** Mean coverage across the plotted months, or 0 when there is nothing to plot. */
export function averageCoverage(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
