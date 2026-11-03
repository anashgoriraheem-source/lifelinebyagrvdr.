/**
 * The dotted world on the session board, placed by real coordinates.
 *
 * The board's original artwork was a decorative Figma export: its dots did not
 * follow any geographic projection, so a real fix plotted on it would have
 * pointed at the wrong part of the world. The look is kept exactly (a grid of
 * small dots, alternately dimmed, with the same shimmer and the same card), but
 * the dots now come from `LAND_RLE` — the 2° Natural Earth grid the location
 * globe already draws from — so a pin for a place sits on that place.
 */
import { GRID_H, GRID_W, landAt, landMask } from "./landGrid";

export const DOT_COLS = GRID_W;
export const DOT_ROWS = GRID_H;
export const DOT_MAP_W = 651;
export const DOT_MAP_H = 317;
export const DOT_STEP_X = DOT_MAP_W / DOT_COLS;
export const DOT_STEP_Y = DOT_MAP_H / DOT_ROWS;
export const DOT_ORIGIN_X = DOT_STEP_X / 2;
export const DOT_ORIGIN_Y = DOT_STEP_Y / 2;

/** Board coordinates (651 × 317) for a real latitude and longitude. */
export function projectDots(lat: number, lng: number): [number, number] {
  return [((lng + 180) / 360) * DOT_MAP_W, ((90 - lat) / 180) * DOT_MAP_H];
}

/** True when this place is land on the grid. */
export function dotIsLand(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return landAt(lat, lng);
}

/** Number of land cells; the same 5392 the globe verifies. */
export function dotCount() {
  let count = 0;
  for (const cell of landMask()) if (cell) count++;
  return count;
}

export { landMask };
