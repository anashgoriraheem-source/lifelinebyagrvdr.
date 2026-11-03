import { describe, expect, it } from "vitest";
import { MONTH_ROWS, averageCoverage, discWidth, monthRows } from "./readingMonths";
import type { ReadingDays } from "./readingDays";

/** Known fixture: 10, 20, 25 and 31 days of readings across four months. */
function fixture(): ReadingDays {
  const days: ReadingDays = {};
  const fill = (month: number, count: number) => {
    for (let d = 1; d <= count; d++)
      days[`2026-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`] = ["hr"];
  };
  fill(7, 10);
  fill(8, 20);
  fill(9, 25);
  fill(10, 31);
  days["2026-11-01"] = ["hr"];
  return days;
}

const NOW = new Date(2026, 10, 3, 12, 0, 0).getTime(); // 3 Nov 2026

describe("reading-days disc chart", () => {
  it("plots the last five months, oldest first", () => {
    const rows = monthRows(fixture(), NOW);
    expect(rows).toHaveLength(MONTH_ROWS);
    expect(rows.map((r) => r.short)).toEqual(["JUL", "AUG", "SEP", "OCT", "NOV"]);
  });

  it("uses the share of elapsed days, so a month in progress is not penalised", () => {
    const rows = monthRows(fixture(), NOW);
    // 10/31, 20/31, 25/30, 31/31 and 1 of 3 elapsed days.
    expect(rows.map((r) => r.value)).toEqual([32, 65, 83, 100, 33]);
    expect(rows[4].elapsed).toBe(3);
  });

  it("reports zeros — never a sample value — for months without readings", () => {
    const rows = monthRows({}, NOW);
    expect(rows.map((r) => r.value)).toEqual([0, 0, 0, 0, 0]);
    expect(averageCoverage(rows.map((r) => r.value))).toBe(0);
  });

  it("keeps disc widths proportional to the dataset maximum", () => {
    const values = [32, 65, 83, 100, 33];
    const widths = values.map((v) => discWidth(v, Math.max(...values)));
    expect(widths[3]).toBeCloseTo(100);
    expect(widths[1]).toBeCloseTo(65);
    expect(widths[0]).toBeCloseTo(32);
    // A zero still gets a visible marker, and never more than the smallest real value.
    expect(discWidth(0, 100)).toBe(12);
    expect(discWidth(0, 100)).toBeLessThan(discWidth(32, 100));
  });

  it("averages only the plotted months", () => {
    expect(averageCoverage([32, 65, 83, 100, 33])).toBeCloseTo(62.6, 1);
    expect(averageCoverage([])).toBe(0);
  });
});
