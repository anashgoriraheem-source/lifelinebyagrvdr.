import { addLog, appStore, set } from "./store";
import { recordPlace } from "./places";

let watchId: number | null = null;
let generation = 0;

/** Start live GPS tracking. Safe to call repeatedly. */
export function startTracking() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    set({
      location: {
        status: "unavailable",
        fix: null,
        error: "This browser has no location support.",
      },
    });
    return;
  }
  if (watchId != null) return;
  set((s) => ({ location: { ...s.location, status: "requesting", error: null } }));
  const session = ++generation;
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (session !== generation) return;
      const first = appStore.state.location.status !== "tracking";
      const fix = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        at: pos.timestamp,
      };
      set((s) => ({
        // A fresh fix clears an older timeout message: the map and the status
        // line must never say "not found" while showing a current position.
        location: { status: "tracking", error: null, fix },
        // The map and the globe draw from the same in-memory record.
        places: recordPlace(s.places, fix),
      }));
      if (first) addLog("location", `Location tracking on · ±${Math.round(pos.coords.accuracy)} m`);
    },
    (err) => {
      if (session !== generation) return;
      // Numeric codes are the spec's own values; some browsers do not expose the
      // named constants on the error object, which silently downgraded a denial
      // to a generic error and left the watch running.
      const denied = err.code === 1; // PERMISSION_DENIED
      const timedOut = err.code === 3; // TIMEOUT
      if (denied && watchId != null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      set((s) => ({
        location: {
          ...s.location,
          status: denied ? "denied" : s.location.fix ? "tracking" : "error",
          error: denied
            ? "Location permission was denied."
            : timedOut
              ? "Waiting for a GPS fix…"
              : "Location unavailable right now.",
        },
      }));
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
}

export function stopTracking() {
  ++generation;
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  set((s) => ({ location: { ...s.location, status: "idle" } }));
}
