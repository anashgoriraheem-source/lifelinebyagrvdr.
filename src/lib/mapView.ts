/**
 * Map view rules: where the map looks and how far in.
 *
 * These are display decisions only. Nothing here changes the fix itself — a
 * coarse fix must never be drawn as a precise point, which is why the starting
 * zoom follows the accuracy the device reported rather than a fixed zoom level.
 */

/** Web Mercator metres per pixel at zoom 0 on the equator. */
export const METRES_PER_PIXEL_Z0 = 156_543.03392;

export const MAP_MIN_ZOOM = 3;
export const MAP_MAX_ZOOM = 18;

/**
 * The zoom at which the reported accuracy is readable instead of misleadingly
 * precise: the accuracy circle (two radii across) spans about half the map box.
 * A 15 m phone fix lands near the top zoom; a 3 km network fix zooms out to the
 * neighbourhood instead of filling the screen with one circle.
 */
export function zoomForAccuracy(accuracyM: number, boxPx = 320, latDeg = 0): number {
  const accuracy = Number.isFinite(accuracyM) && accuracyM > 0 ? accuracyM : 1_000;
  const box = boxPx > 0 ? boxPx : 320;
  const metresPerPixel = (accuracy * 2) / (box * 0.5);
  const latitude = Math.max(-85, Math.min(85, latDeg));
  const scale = (METRES_PER_PIXEL_Z0 * Math.cos((latitude * Math.PI) / 180)) / metresPerPixel;
  const zoom = Math.log2(Math.max(1e-6, scale));
  return Math.max(MAP_MIN_ZOOM, Math.min(MAP_MAX_ZOOM, Math.round(zoom)));
}

/**
 * True when a fix is too approximate to call "your position" without a caveat.
 * The circle on the map is the honest part; this only adds the sentence.
 */
export function accuracyIsCoarse(accuracyM: number, thresholdM = 150) {
  return Number.isFinite(accuracyM) && accuracyM > thresholdM;
}
