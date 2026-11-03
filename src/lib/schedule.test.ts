import { describe, expect, it } from "vitest";
import {
  addMonths,
  dayOptions,
  defaultStart,
  durationLabel,
  endOptions,
  eventsOnDay,
  freeStarts,
  gridDays,
  gridRange,
  isoAt,
  overlaps,
  rangeLabel,
  rangeLabelOf,
  timeLabel,
  type CareEvent,
} from "./schedule";

const day = new Date(2026, 10, 3); // Tuesday 3 November 2026

function event(id: string, startMin: number, endMin: number, on = day): CareEvent {
  return {
    id,
    title: `Event ${id}`,
    startsAt: isoAt(on, startMin),
    endsAt: isoAt(on, endMin),
    color: "stone",
  };
}

describe("month grid", () => {
  it("covers November 2026 in whole Monday-first weeks", () => {
    const days = gridDays(new Date(2026, 10, 15));
    expect(days).toHaveLength(42);
    expect(days[0].toDateString()).toBe(new Date(2026, 9, 26).toDateString());
    expect(days[6].toDateString()).toBe(new Date(2026, 10, 1).toDateString());
    expect(days[41].toDateString()).toBe(new Date(2026, 11, 6).toDateString());
    expect(days.every((d, i) => d.getDay() === ((i % 7) + 1) % 7)).toBe(true);
  });

  it("queries the whole grid plus the day after it", () => {
    const range = gridRange(new Date(2026, 10, 15));
    expect(range.from.toDateString()).toBe(new Date(2026, 9, 26).toDateString());
    expect(range.to.toDateString()).toBe(new Date(2026, 11, 7).toDateString());
  });

  it("moves months without drifting", () => {
    expect(addMonths(new Date(2026, 11, 1), 1).getMonth()).toBe(0);
    expect(addMonths(new Date(2026, 0, 1), -1).getFullYear()).toBe(2025);
  });
});

describe("time wording", () => {
  it("formats the same way the design does", () => {
    expect(timeLabel(540)).toBe("9 AM");
    expect(timeLabel(0)).toBe("12 AM");
    expect(timeLabel(810)).toBe("1:30 PM");
    expect(rangeLabel(660, 840)).toBe("11 AM-2 PM");
    expect(rangeLabel(780, 930)).toBe("1-3:30 PM");
    expect(durationLabel(30)).toBe("30 mins");
    expect(durationLabel(60)).toBe("1 hr");
    expect(durationLabel(90)).toBe("1.5 hrs");
  });

  it("keeps both meridiems when a block crosses midnight", () => {
    const late: CareEvent = {
      id: "late",
      title: "Late",
      startsAt: new Date(2026, 10, 3, 23, 0).toISOString(),
      endsAt: new Date(2026, 10, 4, 1, 0).toISOString(),
      color: "stone",
    };
    expect(rangeLabelOf(late)).toBe("11 PM-1 AM");
  });
});

describe("free time", () => {
  const busy = [event("a", 660, 840), event("b", 900, 1050)];

  it("leaves out every start inside an existing block", () => {
    const starts = freeStarts(busy);
    expect(starts).not.toContain(660);
    expect(starts).not.toContain(690);
    expect(starts).not.toContain(839);
    expect(starts).toContain(840);
    expect(starts).toContain(660 - 30);
    expect(starts[0]).toBe(360);
    expect(starts[starts.length - 1]).toBe(1350);
  });

  it("stops the end list at the next block", () => {
    const ends = endOptions(600, busy);
    expect(ends.map((o) => o.value)).toEqual([630, 660]);
    expect(ends.at(-1)?.duration).toBe(60);

    const afterLunch = endOptions(1050, busy);
    expect(afterLunch.at(-1)?.value).toBe(1410);
  });

  it("offers 9 AM first, then the next free half hour", () => {
    expect(defaultStart([])).toBe(540);
    expect(defaultStart([event("early", 540, 600)])).toBe(600);
  });

  it("reports a fully booked day instead of inventing a slot", () => {
    const packed = [event("all", 360, 1380)];
    const options = dayOptions(packed, undefined);
    expect(options.start).toBeNull();
    expect(options.starts).toEqual([]);
  });

  it("keeps the edited event's own time free for itself", () => {
    const options = dayOptions(busy, "a", 660);
    expect(options.start).toBe(660);
    expect(options.ends.at(-1)?.value).toBe(900);
  });
});

describe("day membership", () => {
  it("finds events by local day, earliest first", () => {
    const late = event("late", 1080, 1140);
    const early = event("early", 480, 540);
    const tomorrow = event("tomorrow", 480, 540, new Date(2026, 10, 4));
    const found = eventsOnDay([late, tomorrow, early], day);
    expect(found.map((e) => e.id)).toEqual(["early", "late"]);
  });

  it("detects overlapping instants", () => {
    expect(overlaps(event("a", 540, 660), event("b", 630, 720))).toBe(true);
    expect(overlaps(event("a", 540, 660), event("b", 660, 720))).toBe(false);
  });
});
