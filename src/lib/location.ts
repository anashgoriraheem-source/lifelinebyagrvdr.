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
        location: { status: "tracking", error: null, fix },
        // The map and the globe draw from the same in-memory record.
        places: recordPlace(s.places, fix),
      }));
      if (first) addLog("location", `Location tracking on · ±${Math.round(pos.coords.accuracy)} m`);
    },
    (err) => {
      if (session !== generation) return;
      const denied = err.code === err.PERMISSION_DENIED;
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
            : err.code === err.TIMEOUT
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
