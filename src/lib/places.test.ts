import { describe, expect, it } from "vitest";
import {
  MAX_PLACES,
  SAME_PLACE_M,
  distanceM,
  formatCoordinates,
  placeAge,
  recordPlace,
  type RecordedPlace,
} from "./places";

const fix = (lat: number, lng: number, at: number, accuracy = 20) => ({ lat, lng, accuracy, at });

describe("recorded places", () => {
  it("keeps the newest fix first and caps the list", () => {
    let places: RecordedPlace[] = [];
    const spots = [
      [28.6139, 77.209],
      [19.076, 72.8777],
      [12.9716, 77.5946],
      [13.0827, 80.2707],
      [22.5726, 88.3639],
      [26.9124, 75.7873],
    ];
    spots.forEach(([lat, lng], i) => {
      places = recordPlace(places, fix(lat, lng, 1_000 + i * 1_000));
    });
    expect(places).toHaveLength(MAX_PLACES);
    expect(places[0].lat).toBeCloseTo(26.9124, 4);
    // The oldest spots fall off; nothing is invented to fill the list.
    expect(places.map((p) => p.lng)).not.toContain(98);
  });

  it("replaces a nearby fix instead of adding a duplicate pin", () => {
    const first = recordPlace([], fix(28.6139, 77.209, 1_000));
    const moved = recordPlace(first, fix(28.6141, 77.2092, 61_000, 12));
    expect(moved).toHaveLength(1);
    expect(moved[0].at).toBe(61_000);
    expect(moved[0].accuracy).toBe(12);
    expect(distanceM(first[0], moved[0])).toBeLessThan(SAME_PLACE_M);
  });

  it("returns the same array for an unchanged leading fix, so the globe does not re-render", () => {
    const first = recordPlace([], fix(28.6139, 77.209, 1_000));
    const again = recordPlace(first, fix(28.6139, 77.209, 1_000));
    expect(again).toBe(first);
  });

  it("rejects an impossible coordinate rather than pinning it", () => {
    const places = recordPlace([], fix(91, 400, 1_000));
    expect(places).toHaveLength(0);
  });

  it("measures distance on the sphere, not in degrees", () => {
    // Delhi → Mumbai is roughly 1,150 km.
    expect(distanceM({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 })).toBeGreaterThan(
      1_100_000,
    );
    expect(distanceM({ lat: 28.6139, lng: 77.209 }, { lat: 19.076, lng: 72.8777 })).toBeLessThan(
      1_200_000,
    );
  });

  it("writes coordinates with a hemisphere, never a guessed address", () => {
    expect(formatCoordinates(28.6139, 77.209)).toBe("28.6139° N, 77.2090° E");
    expect(formatCoordinates(-33.9249, -70.5)).toBe("33.9249° S, 70.5000° W");
  });

  it("describes age in the reader's language", () => {
    expect(placeAge(20_000, "en")).toMatch(/now/i);
    expect(placeAge(6 * 60_000, "en")).toMatch(/6/);
    expect(placeAge(3 * 60 * 60_000, "hi")).toBeTruthy();
  });
});
