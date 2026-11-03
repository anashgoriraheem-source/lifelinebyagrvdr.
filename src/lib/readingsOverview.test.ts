import { describe, expect, it } from "vitest";
import {
  bucketSlices,
  buildMonthBuckets,
  dayDelta,
  ridgeMarkers,
  ridgePoints,
  sliceDashes,
} from "./readingsOverview";
import type { ReadingDays } from "./readingDays";

const now = new Date(2026, 10, 15, 12, 0, 0).getTime(); // 15 Nov 2026

const readingDays: ReadingDays = {
  "2026-11-01": ["hr", "spo2"],
  "2026-11-02": ["hr"],
  "2026-11-20": ["hr"], // in the future — must not be counted
  "2026-10-30": ["bp"],
  "2025-06-03": ["hr"], // outside the 12-month window
};

describe("monthly reading buckets", () => {
  const buckets = buildMonthBuckets(readingDays, now, 12);

  it("returns twelve months, oldest first, ending with the current month", () => {
    expect(buckets).toHaveLength(12);
    expect(buckets[0].key).toBe("2025-12");
    expect(buckets.at(-1)!.key).toBe("2026-11");
  });

  it("counts only past days of the current month and ignores future entries", () => {
    const november = buckets.at(-1)!;
    expect(november.code).toBe("NOV-26");
    expect(november.elapsed).toBe(15);
    expect(november.days).toBe(30);
    expect(november.loggedDays).toBe(2);
    expect(november.vitalDays.hr).toBe(2);
    expect(november.vitalDays.spo2).toBe(1);
    expect(november.vitalDays.bp).toBe(0);
    expect(november.vitalDaysTotal).toBe(3);
    expect(november.coverage).toBeCloseTo(2 / 15);
    expect(november.lastLogged).toBe("2026-11-02");
  });

  it("keeps a complete past month and its coverage", () => {
    const october = buckets.at(-2)!;
    expect(october.elapsed).toBe(31);
    expect(october.loggedDays).toBe(1);
    expect(october.vitalDays.bp).toBe(1);
    expect(october.coverage).toBeCloseTo(1 / 31);
  });

  it("leaves a month with no readings at zero rather than inventing a sample", () => {
    const august = buckets.find((b) => b.key === "2026-08")!;
    expect(august.loggedDays).toBe(0);
    expect(august.vitalDaysTotal).toBe(0);
    expect(august.lastLogged).toBeNull();
    expect(bucketSlices(august)).toEqual([]);
  });
});

describe("delta and slices", () => {
  it("reports a percentage change only against a non-zero baseline", () => {
    expect(dayDelta(2, 1)).toBe(100);
    expect(dayDelta(1, 2)).toBe(-50);
    expect(dayDelta(3, 0)).toBeNull();
    expect(dayDelta(3, null)).toBeNull();
  });

  it("builds cumulative dash offsets normalised to 100", () => {
    const bucket = buildMonthBuckets(readingDays, now, 12).at(-1)!;
    const slices = bucketSlices(bucket);
    expect(slices.map((s) => s.key)).toEqual(["hr", "spo2"]);
    const dashes = sliceDashes(slices);
    expect(dashes[0].dashOffset).toBe(-0);
    expect(dashes[1].dashOffset).toBeCloseTo(-(2 / 3) * 100);
    expect(dashes[0].dashArray).toBe(`${(2 / 3) * 100} ${100 - (2 / 3) * 100}`);
  });
});

describe("ridgeline geometry", () => {
  it("samples the curve and places one marker per month", () => {
    const values = [0, 1, 2, 3, 0, 4];
    expect(ridgePoints(values)).toHaveLength(97);
    expect(ridgePoints(values).every((p) => p.y >= 0 && p.y <= 100)).toBe(true);
    const markers = ridgeMarkers(values);
    expect(markers).toHaveLength(6);
    expect(markers[0].x).toBe(0);
    expect(markers.at(-1)!.x).toBe(100);
  });

  it("keeps a zero month visible above the floor", () => {
    const [point] = ridgePoints([0, 0]);
    expect(point.y).toBeLessThan(100);
    expect(point.y).toBeGreaterThan(0);
  });
});
