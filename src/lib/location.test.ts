import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { appStore, set } from "./store";
import { startTracking, stopTracking } from "./location";

/** A geolocation stand-in: tests drive the callbacks the browser would. */
function fakeGeolocation() {
  let success: PositionCallback | null = null;
  let failure: PositionErrorCallback | null = null;
  const clearWatch = vi.fn();
  const watchPosition = vi.fn(
    (onSuccess: PositionCallback, onError: PositionErrorCallback, options?: PositionOptions) => {
      success = onSuccess;
      failure = onError;
      void options;
      return 7;
    },
  );
  return {
    watchPosition,
    clearWatch,
    succeed(lat: number, lng: number, accuracy: number, at = Date.now()) {
      success?.({
        coords: { latitude: lat, longitude: lng, accuracy },
        timestamp: at,
      } as GeolocationPosition);
    },
    fail(code: number) {
      failure?.({ code } as GeolocationPositionError);
    },
  };
}

describe("location states", () => {
  let geo: ReturnType<typeof fakeGeolocation>;

  beforeEach(() => {
    geo = fakeGeolocation();
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: { watchPosition: geo.watchPosition, clearWatch: geo.clearWatch },
    });
    set({ location: { status: "idle", fix: null, error: null }, places: [] });
  });

  afterEach(() => {
    stopTracking();
    Reflect.deleteProperty(navigator, "geolocation");
  });

  it("asks for a high-accuracy fix and never for an old cached one", () => {
    startTracking();
    expect(geo.watchPosition).toHaveBeenCalledTimes(1);
    const options = geo.watchPosition.mock.calls[0][2];
    expect(options).toMatchObject({ enableHighAccuracy: true });
    expect(options?.maximumAge).toBeLessThanOrEqual(5_000);
    expect(appStore.state.location.status).toBe("requesting");
  });

  it("clears a timeout message when a fix finally arrives", () => {
    startTracking();
    geo.fail(3); // TIMEOUT
    expect(appStore.state.location.status).toBe("error");
    expect(appStore.state.location.error).toContain("Waiting");

    geo.succeed(28.6139, 77.209, 12);
    // The map and the status line must not say "not found" over a current fix.
    expect(appStore.state.location.status).toBe("tracking");
    expect(appStore.state.location.error).toBeNull();
    expect(appStore.state.location.fix).toMatchObject({ lat: 28.6139, lng: 77.209, accuracy: 12 });
  });

  it("keeps the latitude/longitude order the browser reported", () => {
    startTracking();
    geo.succeed(-33.8688, 151.2093, 30);
    const fix = appStore.state.location.fix;
    expect(fix?.lat).toBeCloseTo(-33.8688, 4);
    expect(fix?.lng).toBeCloseTo(151.2093, 4);
    // ...and the recorded place, which the board draws from.
    expect(appStore.state.places[0]).toMatchObject({ lat: -33.8688, lng: 151.2093 });
  });

  it("stops the watch on a denied permission instead of retrying silently", () => {
    startTracking();
    geo.fail(1); // PERMISSION_DENIED
    expect(appStore.state.location.status).toBe("denied");
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
  });

  it("cleans the watch up when tracking stops", () => {
    startTracking();
    stopTracking();
    expect(geo.clearWatch).toHaveBeenCalledWith(7);
    expect(appStore.state.location.status).toBe("idle");
  });

  it("reports a browser without location support instead of pretending", () => {
    Reflect.deleteProperty(navigator, "geolocation");
    startTracking();
    expect(appStore.state.location.status).toBe("unavailable");
    expect(appStore.state.location.fix).toBeNull();
  });
});
