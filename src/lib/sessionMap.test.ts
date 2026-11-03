import { describe, it, expect } from "vitest";
import { distanceM, type RecordedPlace } from "./places";
import { PIN_MERGE_M, sessionPins } from "./sessionMap";

const place = (lat: number, lng: number, at: number, accuracy = 20): RecordedPlace => ({
  id: `${at}-${lat}-${lng}`,
  lat,
  lng,
  accuracy,
  at,
});

describe("session pins for the world board", () => {
  it("merges fixes that fall on the same spot at world scale", () => {
    const places = [place(28.61, 77.21, 500), place(28.7, 77.3, 400), place(28.55, 77.1, 300)];
    const pins = sessionPins(places);
    expect(pins).toHaveLength(1);
    // The pin stands for three fixes and says so, instead of drawing three
    // invisible rings on one pixel.
    expect(pins[0].count).toBe(3);
    expect(pins[0].place.at).toBe(500);
  });

  it("keeps places far apart as separate pins", () => {
    const places = [place(28.61, 77.21, 900), place(51.51, -0.13, 800)];
    const pins = sessionPins(places);
    expect(pins).toHaveLength(2);
    expect(pins.map((p) => p.count)).toEqual([1, 1]);
  });

  it("never merges two places that are further apart than the pixel pitch", () => {
    const a = place(0, 0, 1000);
    const b = place(0, (PIN_MERGE_M / 111_320) * 2, 900);
    expect(distanceM(a, b)).toBeGreaterThan(PIN_MERGE_M);
    expect(sessionPins([a, b])).toHaveLength(2);
  });

  it("grows the dot with the number of fixes it stands for, within bounds", () => {
    const pins = sessionPins([place(10, 10, 500), place(10.05, 10.05, 400)]);
    expect(pins[0].radius).toBeGreaterThan(2.4);
    expect(pins[0].radius).toBeLessThanOrEqual(6);
  });

  it("returns nothing for no places rather than a sample", () => {
    expect(sessionPins([])).toEqual([]);
  });

  it("ignores a coordinate that is not on Earth", () => {
    expect(sessionPins([place(120, 10, 100)])).toEqual([]);
  });
});
