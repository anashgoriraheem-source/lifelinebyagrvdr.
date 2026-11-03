/**
 * Places recorded during this tab's location session.
 *
 * The map and the globe both draw from this list, so it holds exactly the fixes
 * the person allowed: no stored history, no guessing. It lives in memory only —
 * the location card promises that a fix stays "in this open tab", so nothing
 * here is written to device storage or sent anywhere.
 */
import type { LocationFix } from "./types";

export interface RecordedPlace {
  id: string;
  lat: number;
  lng: number;
  accuracy: number;
  at: number;
}

/** Newest first. Five keeps the legend on one row on a desktop board. */
export const MAX_PLACES = 5;

/**
 * A fix this close to a recorded place replaces it instead of adding another
 * pin, so a stationary phone does not fill the globe with the same spot.
 */
export const SAME_PLACE_M = 250;

const EARTH_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

const valid = (lat: number, lng: number) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/**
 * Adds a fix to the recorded places, newest first.
 *
 * Returns the same array when the fix lands on the place already first, so a
 * once-a-second GPS watch does not re-render the globe on every tick. When it
 * lands on an older place, that place is refreshed (new time, accuracy) so the
 * list still reads as the places visited rather than the order of arrival.
 */
export function recordPlace(places: RecordedPlace[], fix: LocationFix): RecordedPlace[] {
  if (!valid(fix.lat, fix.lng)) return places;
  const next: RecordedPlace = {
    id: `${fix.at}-${fix.lat.toFixed(5)}-${fix.lng.toFixed(5)}`,
    lat: fix.lat,
    lng: fix.lng,
    accuracy: fix.accuracy,
    at: fix.at,
  };
  const nearest = places.findIndex((p) => distanceM(p, next) <= SAME_PLACE_M);
  if (nearest === 0) {
    const current = places[0];
    if (current.at === next.at && current.lat === next.lat && current.lng === next.lng) {
      return places;
    }
  }
  const rest = places.filter((_, i) => i !== nearest);
  return [next, ...rest].slice(0, MAX_PLACES);
}

/** Short coordinate text; never rounded tighter than the fix can support. */
export function formatCoordinates(lat: number, lng: number) {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

/**
 * How old a place is, in the person's own language. `numeric: "auto"` keeps
 * "now" as a word instead of "in 0 minutes".
 */
export function placeAge(ageMs: number, locale: string) {
  const minutes = Math.floor(Math.max(0, ageMs) / 60_000);
  const format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "short" });
  // "now" rather than "this minute": seconds are the unit that renders as a word.
  if (minutes < 1) return format.format(0, "second");
  if (minutes < 60) return format.format(-minutes, "minute");
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return format.format(-hours, "hour");
  return format.format(-Math.floor(hours / 24), "day");
}
