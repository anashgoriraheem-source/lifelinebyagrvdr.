/**
 * Pure helpers for the care-schedule calendar. No React, no network: the view,
 * the dialog and the server function all use the same minute maths so a time
 * shown as free cannot be rejected as overlapping later.
 */

export const CARE_COLORS = ["yellow", "peach", "lilac", "sage", "stone"] as const;
export type CareColor = (typeof CARE_COLORS)[number];

export function isCareColor(value: string): value is CareColor {
  return (CARE_COLORS as readonly string[]).includes(value);
}

/** One planned care block as the browser receives it. */
export interface CareEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  color: CareColor;
}

/** A block as the dialog asks the server to save it. */
export interface CareEventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  color: CareColor;
}

/** First and last time a block may start or end, in minutes after midnight. */
export const FIRST_START_MIN = 6 * 60;
export const LAST_START_MIN = 22 * 60 + 30;
export const LAST_END_MIN = 23 * 60 + 30;
export const TIME_STEP_MIN = 30;
/** The longest block the dialog offers; mirrors the table's 12 hour check. */
export const MAX_BLOCK_MIN = 12 * 60;

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Monday on or before the first of the month — the grid starts there. */
export function gridStart(month: Date): Date {
  const first = startOfMonth(month);
  const offset = (first.getDay() + 6) % 7; // Sunday 0 -> 6, Monday 1 -> 0
  return addDays(first, -offset);
}

/** Every cell of the month grid, Monday first, whole weeks only. */
export function gridDays(month: Date): Date[] {
  const days: Date[] = [];
  const last = startOfMonth(addMonths(month, 1));
  let cursor = gridStart(month);
  while (cursor < last) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  while (days.length % 7 !== 0) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

/** Half-open range that covers the whole grid, for one server query. */
export function gridRange(month: Date): { from: Date; to: Date } {
  const start = gridStart(month);
  const days = gridDays(month);
  return { from: start, to: addDays(start, days.length) };
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** Local calendar day key, e.g. `2026-11-03`. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function weekdayShort(date: Date): (typeof WEEKDAYS)[number] {
  return WEEKDAYS[(date.getDay() + 6) % 7];
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** The instant for `minutes` after midnight on the given local day. */
export function atMinutes(day: Date, minutes: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, minutes, 0, 0);
}

export function monthLabel(month: Date, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month);
}

export function dayHeading(day: Date, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(day);
}

/** Events that start on the given local day, earliest first. */
export function eventsOnDay(events: CareEvent[], day: Date): CareEvent[] {
  return events
    .filter((event) => sameDay(new Date(event.startsAt), day))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

export function partsOf(minutes: number): { time: string; meridiem: "AM" | "PM" } {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return {
    time: `${hours % 12 || 12}${mins ? `:${String(mins).padStart(2, "0")}` : ""}`,
    meridiem: hours >= 12 ? "PM" : "AM",
  };
}

/** "9 AM", "1:30 PM" — the same wording the design reference uses. */
export function timeLabel(minutes: number): string {
  const { time, meridiem } = partsOf(minutes);
  return `${time} ${meridiem}`;
}

/** "30 mins", "1 hr", "1.5 hrs" for the end list. */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} mins`;
  const hours = minutes / 60;
  return `${hours} ${hours === 1 ? "hr" : "hrs"}`;
}

/** "1-3:30 PM" inside one half of the day, "11 AM-2 PM" across noon. */
export function rangeLabel(startMinutes: number, endMinutes: number): string {
  const start = partsOf(startMinutes);
  const end = partsOf(endMinutes);
  const lead = start.meridiem === end.meridiem ? start.time : `${start.time} ${start.meridiem}`;
  return `${lead}-${end.time} ${end.meridiem}`;
}

export function rangeLabelOf(event: Pick<CareEvent, "startsAt" | "endsAt">): string {
  const start = new Date(event.startsAt);
  const end = new Date(event.endsAt);
  if (!sameDay(start, end)) {
    // A block that crosses midnight keeps both meridiems so it cannot be misread.
    return `${timeLabel(minutesOfDay(start))}-${timeLabel(minutesOfDay(end))}`;
  }
  return rangeLabel(minutesOfDay(start), minutesOfDay(end));
}

interface Busy {
  start: number;
  end: number;
}

/** The other blocks on the same day, as [start, end) minutes. */
function busyOnDay(dayEvents: CareEvent[], excludeId?: string): Busy[] {
  return dayEvents
    .filter((event) => event.id !== excludeId)
    .map((event) => ({
      start: minutesOfDay(new Date(event.startsAt)),
      end: minutesOfDay(new Date(event.endsAt)),
    }))
    .filter((slot) => slot.end > slot.start);
}

/** Starts between FIRST_START_MIN and LAST_START_MIN that do not overlap. */
export function freeStarts(dayEvents: CareEvent[], excludeId?: string): number[] {
  const busy = busyOnDay(dayEvents, excludeId);
  const options: number[] = [];
  for (let minute = FIRST_START_MIN; minute <= LAST_START_MIN; minute += TIME_STEP_MIN) {
    if (busy.every((slot) => minute < slot.start || minute >= slot.end)) options.push(minute);
  }
  return options;
}

/** End times after `start`, stopping at the next block's start. */
export function endOptions(
  startMinutes: number,
  dayEvents: CareEvent[],
  excludeId?: string,
): { value: number; duration: number }[] {
  const nextStart = busyOnDay(dayEvents, excludeId)
    .filter((slot) => slot.start > startMinutes)
    .reduce((limit, slot) => Math.min(limit, slot.start), LAST_END_MIN);
  const limit = Math.min(LAST_END_MIN, nextStart, startMinutes + MAX_BLOCK_MIN);
  const options: { value: number; duration: number }[] = [];
  for (let minute = startMinutes + TIME_STEP_MIN; minute <= limit; minute += TIME_STEP_MIN) {
    options.push({ value: minute, duration: minute - startMinutes });
  }
  return options;
}

/** Default start for a new block on a day: 9 AM when free, else the first free slot. */
export function defaultStart(dayEvents: CareEvent[]): number | null {
  const options = freeStarts(dayEvents);
  if (options.length === 0) return null;
  if (options.includes(9 * 60)) return 9 * 60;
  return options.find((minute) => minute > 9 * 60) ?? options[0];
}

/** Default end: one hour after the start, clipped to the next block / closing. */
export function defaultEnd(startMinutes: number, dayEvents: CareEvent[], excludeId?: string): number {
  const options = endOptions(startMinutes, dayEvents, excludeId);
  const oneHour = options.find((option) => option.duration === 60);
  return oneHour?.value ?? options[0]?.value ?? Math.min(startMinutes + TIME_STEP_MIN, LAST_END_MIN);
}

/** ISO instant for a local day and minute pair. */
export function isoAt(day: Date, minutes: number): string {
  return atMinutes(day, minutes).toISOString();
}

/** True when two stored events share any instant. Used before saving. */
export function overlaps(a: { startsAt: string; endsAt: string }, b: { startsAt: string; endsAt: string }): boolean {
  return Date.parse(a.startsAt) < Date.parse(b.endsAt) && Date.parse(b.startsAt) < Date.parse(a.endsAt);
}

/**
 * What the dialog can offer for one day. `null` start means the day is full.
 * Keeping this in one place means the picker, the save button and the server
 * validation agree.
 */
export function dayOptions(
  dayEvents: CareEvent[],
  editId: string | undefined,
  preferredStart?: number,
): { start: number | null; end: number; starts: number[]; ends: { value: number; duration: number }[] } {
  const starts = freeStarts(dayEvents, editId);
  // When editing, keep the stored time even if it is not on a 30 minute step.
  const start =
    editId && preferredStart != null
      ? preferredStart
      : preferredStart != null && starts.includes(preferredStart)
        ? preferredStart
        : defaultStart(dayEvents);
  if (start == null) return { start: null, end: 0, starts, ends: [] };
  const ends = endOptions(start, dayEvents, editId);
  return { start, end: defaultEnd(start, dayEvents, editId), starts, ends };
}
