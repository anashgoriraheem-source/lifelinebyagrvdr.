import { useApp } from "@/hooks/useApp";
import { useI18n } from "@/i18n";
import { useNow } from "@/hooks/useNow";
import { startTracking, stopTracking } from "@/lib/location";
import { mapsLink, STALE_FIX_MS } from "@/lib/sos";
import { Button } from "@/components/ui/button";
export function LocationCard() {
  const { locale, t, formatDateTime, formatNumber } = useI18n();
  const loc = useApp((s) => s.location);
  const now = useNow();
  const active = loc.status === "tracking" || loc.status === "requesting";
  const copy =
    locale === "hi"
      ? {
          title: "वैकल्पिक स्थान",
          body: "फोन से स्थान लेने पर यह खुले टैब में रहता है। संदेश में शामिल करना अलग से चुनना होगा। नक्शा खोलने पर निर्देशांक नक्शा सेवा को भेजे जाते हैं।",
          start: "स्थान लेने की अनुमति दें",
          stop: "स्थान लेना बंद करें",
          off: "स्थान बंद है। कोई नया स्थान साझा नहीं किया गया।",
          waiting: "अनुमति और स्थान का इंतज़ार है।",
          denied:
            "स्थान की अनुमति बंद है। फोन पर अपना पता बताएँ, या ब्राउज़र की साइट सेटिंग में अनुमति दें।",
          error: "स्थान नहीं मिल पाया। बाहर खुली जगह में फिर कोशिश करें या अपना पता फोन पर बताएँ।",
          map: "नक्शा सेवा में स्थान खोलें",
        }
      : {
          title: "Optional location",
          body: "Your phone’s location stays in this open tab. Including it in a message is a separate choice. Opening a map sends these coordinates to the map provider.",
          start: "Allow this page to find my location",
          stop: "Stop finding location",
          off: "Location is off. No new location has been shared.",
          waiting: "Waiting for permission and a location.",
          denied:
            "Location permission is blocked. Tell someone your address by phone, or allow this site in your browser settings.",
          error:
            "Location could not be found. Try again in an open area or give your address by phone.",
          map: "Open location with the map provider",
        };
  const status =
    loc.status === "requesting"
      ? copy.waiting
      : loc.status === "denied"
        ? copy.denied
        : loc.error
          ? copy.error
          : loc.fix
            ? now - loc.fix.at > STALE_FIX_MS
              ? t("release.oldLocation")
              : formatDateTime(loc.fix.at)
            : copy.off;
  return (
    <section aria-labelledby="location-title" className="rounded-lg border border-border p-4">
      <h2 id="location-title" className="text-lg font-bold">
        {copy.title}
      </h2>
      <p className="mt-3 text-sm">{copy.body}</p>
      <p role="status" aria-live="polite" className="mt-3 text-sm">
        {status}
      </p>
      <Button
        className="mt-4"
        variant="outline"
        onClick={() => (active ? stopTracking() : startTracking())}
      >
        {active ? copy.stop : copy.start}
      </Button>
      {loc.fix && (
        <div className="mt-4">
          <p className="break-words font-mono text-sm">
            {formatNumber(loc.fix.lat, { maximumFractionDigits: 5 })},{" "}
            {formatNumber(loc.fix.lng, { maximumFractionDigits: 5 })} · ±
            {formatNumber(Math.round(loc.fix.accuracy))} m
          </p>
          <a
            href={mapsLink(loc.fix)}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center text-primary underline"
          >
            {copy.map}
          </a>
        </div>
      )}
    </section>
  );
}
