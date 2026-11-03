import { describe, it, expect } from "vitest";
import { dotCount, dotIsLand, projectDots } from "./worldDots";

/**
 * The pins on the session board sit on this bitmap, so the bitmap has to be a
 * straight equirectangular world: a fix for a real place must land on that
 * place's land cell. These checks are the projection test.
 */
describe("dotted world map", () => {
  it("draws the continents from the app's verified land grid", () => {
    expect(dotCount()).toBe(5_392);
  });

  it.each([
    ["Delhi", 28.61, 77.21],
    ["London", 51.51, -0.13],
    ["Sydney", -33.87, 151.21],
    ["São Paulo", -23.55, -46.63],
    ["Nairobi", -1.29, 36.82],
    ["Tokyo", 35.68, 139.69],
    ["New York", 40.71, -74.0],
  ])("puts %s on land", (_name, lat, lng) => {
    expect(dotIsLand(lat as number, lng as number)).toBe(true);
  });

  it.each([
    ["mid Pacific", 0, -150],
    ["mid Atlantic", 30, -40],
    ["Indian Ocean", -30, 80],
  ])("keeps %s as sea", (_name, lat, lng) => {
    expect(dotIsLand(lat as number, lng as number)).toBe(false);
  });

  it("projects the poles and the date line onto the map edges", () => {
    expect(projectDots(90, -180)).toEqual([0, 0]);
    const [x, y] = projectDots(-90, 180);
    expect(x).toBeCloseTo(651, 5);
    expect(y).toBeCloseTo(317, 5);
  });

  it("does not invent a cell for a coordinate that is not on Earth", () => {
    expect(dotIsLand(120, 0)).toBe(false);
    expect(dotIsLand(Number.NaN, 0)).toBe(false);
  });
});
