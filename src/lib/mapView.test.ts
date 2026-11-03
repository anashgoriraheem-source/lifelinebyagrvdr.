import { describe, it, expect } from "vitest";
import { MAP_MAX_ZOOM, MAP_MIN_ZOOM, accuracyIsCoarse, zoomForAccuracy } from "./mapView";

describe("map zoom follows the reported accuracy", () => {
  it("zooms in for a tight phone fix and out for a coarse network fix", () => {
    const tight = zoomForAccuracy(12);
    const coarse = zoomForAccuracy(3_000);
    expect(tight).toBeGreaterThan(coarse);
    expect(tight).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    expect(coarse).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
  });

  it("keeps a 1 km fix out of street level instead of pretending to be precise", () => {
    // The old rule used a fixed zoom of 14–16, which put a kilometre-wide error
    // circle far off the screen.
    const zoom = zoomForAccuracy(1_000, 320);
    expect(zoom).toBeLessThanOrEqual(15);
    expect(zoom).toBeGreaterThanOrEqual(12);
  });

  it("never returns a zoom outside the usable range", () => {
    for (const accuracy of [0, -5, 0.5, 50, 8_000, 100_000, Number.NaN]) {
      const zoom = zoomForAccuracy(accuracy);
      expect(Number.isFinite(zoom)).toBe(true);
      expect(zoom).toBeGreaterThanOrEqual(MAP_MIN_ZOOM);
      expect(zoom).toBeLessThanOrEqual(MAP_MAX_ZOOM);
    }
  });

  it("zooms out a little at high latitude where a pixel covers less ground", () => {
    expect(zoomForAccuracy(50, 320, 70)).toBeLessThan(zoomForAccuracy(50, 320, 0));
  });

  it("only calls a fix coarse above the threshold", () => {
    expect(accuracyIsCoarse(20)).toBe(false);
    expect(accuracyIsCoarse(151)).toBe(true);
    expect(accuracyIsCoarse(Number.NaN)).toBe(false);
  });
});
