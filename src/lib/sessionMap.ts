/**
 * Pins for the session board: the recorded places, placed at their real
 * coordinates on the dotted world map.
 *
 * The board is 651 px across the whole world, so one pixel is roughly 200 km at
 * the equator. Places closer together than that cannot be shown apart, and
 * drawing five rings on one pixel would look like a fault — so nearby fixes
 * share one pin, and the pin carries how many fixes it stands for. Nothing is
 * moved: a pin is always exactly at the place it describes.
 */
import { distanceM, type RecordedPlace } from "./places";

/** Two fixes closer than this share a pin at world scale (about four pixels). */
export const PIN_MERGE_M = 800_000;

export interface SessionPin {
  /** Newest place this pin stands for; its coordinates are the pin's position. */
  place: RecordedPlace;
  /** How many recorded places fall on this pin (1 = just this one). */
  count: number;
  /** Dot radius inside the 651 × 317 board space. */
  radius: number;
}

const onEarth = (p: RecordedPlace) =>
  Number.isFinite(p.lat) &&
  Number.isFinite(p.lng) &&
  Math.abs(p.lat) <= 90 &&
  Math.abs(p.lng) <= 180;

/** Newest first, like `places`, with nearby fixes folded into one pin. */
export function sessionPins(places: RecordedPlace[]): SessionPin[] {
  const pins: SessionPin[] = [];
  for (const place of places) {
    if (!onEarth(place)) continue;
    const hit = pins.find((pin) => distanceM(pin.place, place) <= PIN_MERGE_M);
    if (hit) hit.count += 1;
    else pins.push({ place, count: 1, radius: 0 });
  }
  return pins.map((pin) => ({
    ...pin,
    // A dot that stands for more fixes is a little bigger — the same way the
    // board's original dots carried their market size.
    radius: Math.min(6, 2.4 + (pin.count - 1) * 0.9),
  }));
}
