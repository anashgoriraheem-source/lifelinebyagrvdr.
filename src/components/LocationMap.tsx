import { useCallback, useEffect, useRef, useState } from "react";
import { LocateFixed, Minus, Navigation, Plus, Share2 } from "lucide-react";
import type { LocationFix } from "@/lib/types";
import { formatCoordinates } from "@/lib/places";
import { accuracyIsCoarse, zoomForAccuracy } from "@/lib/mapView";
// Leaflet positions its tiles and panes from its own stylesheet. Without this
// import the tiles render unpositioned, so the map shows as broken quadrants.
import "leaflet/dist/leaflet.css";
import "../styles/location-map.css";

/**
 * The interactive map: a real tile map (Leaflet) that shows the fix this tab
 * was allowed to read.
 *
 * Everything on it is honest about what it knows — one marker, the accuracy
 * circle the browser reported, and the time of the last update. There is no
 * guessed address, no geocoding and no finer precision than the fix carries.
 * The tiles come from OpenStreetMap, so their attribution stays on the map and
 * a failed tile load is shown as a provider error rather than a blank square.
 */

const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

export interface LocationMapProps {
  fix: LocationFix | null;
  /** Human time of the fix, already formatted in the person's locale. */
  lastUpdated: string;
  /** True when the newest fix is older than the freshness window. */
  stale: boolean;
  locale: string;
  compact?: boolean;
}

export function LocationMap({
  fix,
  lastUpdated,
  stale,
  locale,
  compact = false,
}: LocationMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const markerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const accuracyRef = useRef<import("leaflet").Circle | null>(null);
  const followRef = useRef(true);
  /** False until the first fix has set the view; later fixes must not re-zoom. */
  const framedRef = useRef(false);
  const [follow, setFollow] = useState(true);
  const [tileError, setTileError] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine === false : false,
  );
  const [copied, setCopied] = useState<"idle" | "ok" | "failed">("idle");
  const [mapReady, setMapReady] = useState(false);

  const hi = locale === "hi";
  const copy = {
    recenter: hi ? "मेरे स्थान पर लौटें" : "Recenter on my location",
    zoomIn: hi ? "नक्शा ज़ूम इन करें" : "Zoom in",
    zoomOut: hi ? "नक्शा ज़ूम आउट करें" : "Zoom out",
    coarse: (metres: number) =>
      hi
        ? `आपका डिवाइस आपको लगभग ${metres} मीटर के भीतर बताता है। छायांकित वृत्त उतनी जगह दिखाता है — निशान उससे ज़्यादा सटीक नहीं है।`
        : `Your device places you within about ${metres} m. The shaded circle shows that area — the marker is not more precise than that.`,
    follow: hi ? "मेरे साथ चलें" : "Follow me",
    following: hi ? "मेरे साथ चल रहा है" : "Following you",
    copied: hi ? "नकल हो गया" : "Copied",
    copyFailed: hi ? "नकल नहीं हो सका" : "Could not copy",
    share: hi ? "स्थान साझा करें" : "Share location",
    copyHint: hi
      ? "नकल करने पर केवल निर्देशांक क्लिपबोर्ड में जाते हैं। जब तक आप चिपकाते नहीं, कुछ नहीं भेजा जाता।"
      : "Copying puts only the coordinates on your clipboard. Nothing is sent until you paste them.",
    tileError: hi
      ? "नक्शे की पृष्ठभूमि लोड नहीं हुई — नक्शा सेवा से संपर्क नहीं हुआ। निर्देशांक नीचे अभी भी सही हैं।"
      : "The map background did not load — the map provider could not be reached. The coordinates below are still correct.",
    offline: hi
      ? "आप ऑफ़लाइन हैं। नक्शे की पृष्ठभूमि नहीं आएगी; आपका दर्ज स्थान नीचे रहेगा।"
      : "You are offline. The map background cannot load; your recorded location stays below.",
    noFix: hi
      ? "अभी कोई स्थान नहीं है। नक्शा आपके स्थान पर तभी केंद्रित होगा जब आप अनुमति दें।"
      : "No location yet. The map centres on you once you allow location.",
    world: hi ? "दुनिया का नक्शा" : "World map",
  };

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || mapRef.current) return;
    let cancelled = false;
    let map: import("leaflet").Map | null = null;
    let observer: ResizeObserver | null = null;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !box) return;
      const accent = getComputedStyle(box).getPropertyValue("--primary").trim() || "#d8bb76";
      map = L.map(box, {
        zoomControl: false,
        attributionControl: true,
        worldCopyJump: true,
        minZoom: 2,
        maxZoom: 19,
      }).setView([20, 0], 2);

      const tiles = L.tileLayer(TILE_URL, {
        maxZoom: 19,
        attribution: TILE_ATTRIBUTION,
        crossOrigin: true,
      });
      tiles.on("tileerror", () => setTileError(true));
      tiles.on("load", () => setTileError(false));
      tiles.addTo(map);

      // Leaflet's own zoom control is left out: the app draws its own 44 px
      // buttons over the map so the targets work for mouse and touch alike.
      // Keyboard zoom still works on the focused map (+ / -).
      // Dragging the map is the person choosing where to look, so follow stops.
      map.on("dragstart", () => {
        followRef.current = false;
        setFollow(false);
      });

      // Keep the map honest about its shape: a container that changes size
      // (rotate, split view, watch width) needs a fresh projection.
      observer = new ResizeObserver(() => map?.invalidateSize());
      observer.observe(box);

      mapRef.current = map;
      setMapReady(true);
    })();

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
      markerRef.current = null;
      accuracyRef.current = null;
    };
  }, []);

  // Marker + accuracy circle follow the newest fix.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix) return;
    void (async () => {
      const L = await import("leaflet");
      if (mapRef.current !== map) return;
      const box = boxRef.current;
      if (!box) return;
      const accent = getComputedStyle(box).getPropertyValue("--primary").trim() || "#d8bb76";
      const point: [number, number] = [fix.lat, fix.lng];
      if (!markerRef.current) {
        markerRef.current = L.circleMarker(point, {
          radius: 8,
          color: "#0b0c10",
          weight: 2,
          fillColor: accent,
          fillOpacity: 1,
        }).addTo(map);
      } else {
        markerRef.current.setLatLng(point);
      }
      // The circle is the accuracy the browser actually reported — it is never
      // shrunk to look more precise.
      if (!accuracyRef.current) {
        accuracyRef.current = L.circle(point, {
          radius: Math.max(1, fix.accuracy),
          color: accent,
          weight: 1,
          opacity: 0.8,
          fillColor: accent,
          fillOpacity: 0.14,
        }).addTo(map);
      } else {
        accuracyRef.current.setLatLng(point);
        accuracyRef.current.setRadius(Math.max(1, fix.accuracy));
      }
      // A coarse fix gets a wider view: the circle has to fit on the map, or the
      // marker looks far more precise than the device actually reported.
      const fit = zoomForAccuracy(fix.accuracy, box?.clientWidth ?? 320, fix.lat);
      if (!framedRef.current) {
        framedRef.current = true;
        map.setView(point, fit, { animate: false });
      } else if (followRef.current) {
        // Pan with the fix but keep the zoom the person chose, unless they are
        // zoomed in past what the accuracy supports.
        if (map.getZoom() > fit + 1) map.setView(point, fit, { animate: true });
        else map.panTo(point, { animate: true });
      }
    })();
  }, [fix, mapReady]);

  const recenter = useCallback(() => {
    followRef.current = true;
    setFollow(true);
    const map = mapRef.current;
    if (!map || !fix) return;
    // Recentring also restores a zoom that shows the whole accuracy circle.
    map.setView(
      [fix.lat, fix.lng],
      zoomForAccuracy(fix.accuracy, boxRef.current?.clientWidth ?? 320, fix.lat),
      { animate: true },
    );
  }, [fix]);

  const zoomBy = (direction: 1 | -1) => {
    const map = mapRef.current;
    if (!map) return;
    if (direction === 1) map.zoomIn();
    else map.zoomOut();
  };

  const toggleFollow = () => {
    const next = !follow;
    followRef.current = next;
    setFollow(next);
    if (next) recenter();
  };

  const coordinateText = fix
    ? `${formatCoordinates(fix.lat, fix.lng)} (±${Math.round(fix.accuracy)} m)`
    : "";

  const copyLocation = async () => {
    if (!fix) return;
    try {
      await navigator.clipboard.writeText(
        `${coordinateText} · ${new Date(fix.at).toLocaleString(locale)}`,
      );
      setCopied("ok");
    } catch {
      setCopied("failed");
    }
    window.setTimeout(() => setCopied("idle"), 3000);
  };

  const shareLocation = async () => {
    if (!fix) return;
    const text = `${coordinateText} · ${new Date(fix.at).toLocaleString(locale)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Lifeline location", text });
        return;
      } catch {
        /* The person cancelled the share sheet — nothing was sent. */
        return;
      }
    }
    void copyLocation();
  };

  return (
    <div className={`lmap${compact ? " lmap--compact" : ""}`}>
      <div className="lmap-frame">
        <div
          ref={boxRef}
          className="lmap-canvas"
          role="region"
          aria-label={
            fix ? `${hi ? "नक्शा" : "Map"} — ${coordinateText}, ${lastUpdated}` : copy.world
          }
        />
        {fix && (
          <div className="lmap-status" role="status" aria-live="polite">
            <span className={stale ? "lmap-live is-stale" : "lmap-live"}>
              {stale
                ? hi
                  ? "पुराना स्थान"
                  : "Not current"
                : hi
                  ? "अभी का स्थान"
                  : "Current location"}
            </span>
            <span className="lmap-time">{lastUpdated}</span>
          </div>
        )}
        <div className="lmap-actions">
          <button
            type="button"
            className="lmap-btn"
            onClick={() => zoomBy(1)}
            aria-label={copy.zoomIn}
            title={copy.zoomIn}
          >
            <Plus aria-hidden="true" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="lmap-btn"
            onClick={() => zoomBy(-1)}
            aria-label={copy.zoomOut}
            title={copy.zoomOut}
          >
            <Minus aria-hidden="true" strokeWidth={2} />
          </button>
          <button
            type="button"
            className="lmap-btn"
            onClick={recenter}
            disabled={!fix}
            aria-label={copy.recenter}
            title={copy.recenter}
          >
            <LocateFixed aria-hidden="true" strokeWidth={1.8} />
          </button>
          <button
            type="button"
            className={`lmap-btn${follow ? " is-on" : ""}`}
            onClick={toggleFollow}
            disabled={!fix}
            aria-pressed={follow}
            aria-label={copy.follow}
            title={follow ? copy.following : copy.follow}
          >
            <Navigation aria-hidden="true" strokeWidth={1.8} />
          </button>
        </div>
      </div>

      {(tileError || offline) && (
        <p className={offline ? "lmap-warn" : "lmap-note"} role="status">
          {offline ? copy.offline : copy.tileError}
        </p>
      )}

      {fix ? (
        <div className="lmap-details">
          <p className="lmap-coords">
            {coordinateText}
            {stale ? (
              <span className="lmap-stale">
                {" "}
                · {hi ? "पुराना" : "out of date"} — {hi ? "फिर से देखें" : "check again"}
              </span>
            ) : null}
          </p>
          <div className="lmap-share">
            <button type="button" className="lmap-share-btn" onClick={copyLocation}>
              {copied === "ok"
                ? copy.copied
                : copied === "failed"
                  ? copy.copyFailed
                  : hi
                    ? "निर्देशांक कॉपी करें"
                    : "Copy coordinates"}
            </button>
            <button type="button" className="lmap-share-btn" onClick={shareLocation}>
              <Share2 aria-hidden="true" strokeWidth={1.8} className="lmap-share-icon" />
              {copy.share}
            </button>
          </div>
          {accuracyIsCoarse(fix.accuracy) ? (
            <p className="lmap-note">{copy.coarse(Math.round(fix.accuracy))}</p>
          ) : null}
          <p className="lmap-hint">{copy.copyHint}</p>
        </div>
      ) : (
        <p className="lmap-hint">{copy.noFix}</p>
      )}
    </div>
  );
}
