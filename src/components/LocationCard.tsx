import { useApp } from "@/hooks/useApp";
import { useI18n } from "@/i18n";
import { useNow } from "@/hooks/useNow";
import { startTracking, stopTracking } from "@/lib/location";
import { Button } from "@/components/ui/button";
import { LocationMap } from "@/components/LocationMap";
import { STALE_FIX_MS } from "@/lib/sos";

/**
 * Location: allow it deliberately, see exactly what the browser gave, and keep
 * it in this tab. The map is a real tile map; the status line and the map's own
 * "current / not current" readout are driven by the same fix, so a stale
 * position can never look live.
 */
export function LocationCard() {
  const { locale, formatTime } = useI18n();
  const loc = useApp((s) => s.location);
  const now = useNow();
  const active = loc.status === "tracking" || loc.status === "requesting";
  const fix = loc.fix;
  // One place decides "current": the same window the SOS draft uses.
  const stale = !fix || now - fix.at > STALE_FIX_MS;
  const copy =
    locale === "hi"
      ? {
          title: "आपका स्थान",
          body: "स्थान केवल इस खुले टैब में रहता है और कहीं सहेजा नहीं जाता। नक्शे की पृष्ठभूमि ओपनस्ट्रीटमैप से आती है, यानी नक्शा खुलने पर निर्देशांक उस सेवा तक जाते हैं। संदेश में स्थान जोड़ना अलग से चुनना होगा।",
          start: "स्थान खोजने दें",
          stop: "स्थान खोजना बंद करें",
          off: "स्थान बंद है। कोई नया स्थान साझा नहीं किया गया।",
          waiting: "अनुमति और स्थान का इंतज़ार है।",
          denied:
            "स्थान की अनुमति बंद है। फोन पर अपना पता बताएँ, या ब्राउज़र की साइट सेटिंग में अनुमति दें और फिर कोशिश करें।",
          unavailable:
            "इस ब्राउज़र में स्थान सुविधा नहीं है। फोन पर अपना पता बताएँ — ऐप अनुमान नहीं लगाएगा।",
          error: "स्थान नहीं मिल पाया। बाहर खुली जगह में फिर कोशिश करें या अपना पता फोन पर बताएँ।",
          stale: "पिछला स्थान दिख रहा है — यह अभी का नहीं है।",
          live: "स्थान चालू है और इसी टैब में अपडेट हो रहा है।",
          accuracy: "सटीकता",
          privacy: "स्थान आपकी अनुमति के बिना किसी को नहीं भेजा जाता।",
        }
      : {
          title: "Your location",
          body: "Location stays in this open tab and is not saved anywhere. The map background comes from OpenStreetMap, so opening the map sends your coordinates to that service. Adding location to a message is a separate choice.",
          start: "Allow this page to find my location",
          stop: "Stop finding location",
          off: "Location is off. No new location has been shared.",
          waiting: "Waiting for permission and a location.",
          denied:
            "Location permission is blocked. Tell someone your address by phone, or allow this site in your browser settings and try again.",
          unavailable:
            "This browser has no location support. Give your address by phone — the app will not guess.",
          error:
            "Location could not be found. Try again in an open area or give your address by phone.",
          stale: "Showing the last known place — it is not current.",
          live: "Location is on and updating in this tab.",
          accuracy: "Accuracy",
          privacy: "Your location is not sent to anyone without your permission.",
        };

  const status =
    loc.status === "requesting"
      ? copy.waiting
      : loc.status === "denied"
        ? copy.denied
        : loc.status === "unavailable"
          ? copy.unavailable
          : loc.error
            ? copy.error
            : fix
              ? stale
                ? copy.stale
                : copy.live
              : copy.off;

  return (
    <section aria-labelledby="location-title" className="rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="location-title" className="text-lg font-bold">
          {copy.title}
        </h2>
        <span
          className={`inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs font-semibold ${
            fix && !stale ? "text-success" : "text-muted-foreground"
          }`}
        >
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ background: "currentColor" }}
          />
          {loc.status === "requesting"
            ? locale === "hi"
              ? "खोज रहे हैं"
              : "Finding you"
            : !fix
              ? locale === "hi"
                ? "स्थान नहीं"
                : "No location"
              : stale
                ? locale === "hi"
                  ? "अभी नहीं"
                  : "Not current"
                : locale === "hi"
                  ? "अभी का"
                  : "Current"}
        </span>
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.body}</p>

      <div className="mt-4">
        <LocationMap
          fix={fix}
          locale={locale}
          stale={stale}
          lastUpdated={fix ? formatTime(fix.at) : ""}
        />
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm">
        {status}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button
          variant={active ? "outline" : "default"}
          onClick={() => (active ? stopTracking() : startTracking())}
        >
          {active ? copy.stop : copy.start}
        </Button>
        {fix ? (
          <span className="text-sm text-muted-foreground">
            {copy.accuracy} ±{Math.round(fix.accuracy)} m
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.privacy}</p>
    </section>
  );
}
