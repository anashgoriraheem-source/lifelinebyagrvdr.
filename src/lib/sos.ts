/**
 * Builds the emergency message and the one-tap links that hand it to the
 * phone's own dialer and messaging apps. Nothing is sent silently: the
 * person confirms in their messaging app. Server-side SMS/voice via
 * Twilio arrives in a later milestone (see PLAN.md).
 */
import type { AlarmReason, LocationFix } from "./types";
import { appStore } from "./store";

export const mapsLink = (f: LocationFix) =>
  `https://maps.google.com/?q=${f.lat.toFixed(6)},${f.lng.toFixed(6)}`;

export const clockTime = (t: number) =>
  new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** A location older than this must not be presented as current in a message. */
export const STALE_FIX_MS = 120_000;

/** Default drafts include no medical profile, readings, precise location or
 * tracking tokens. Each sensitive category needs a deliberate per-draft choice.
 */
export function buildSosMessage(
  reason: AlarmReason | null,
  fix: LocationFix | null,
  opts: { test?: boolean; includeLocation?: boolean; includeMedical?: boolean } = {},
) {
  const p = appStore.state.profile;
  const hi = appStore.state.language === "hi";
  const lines = [
    opts.test
      ? "[TEST / परीक्षण — no action needed]"
      : hi
        ? "मुझे मदद चाहिए। कृपया मुझे कॉल करें।"
        : "I need help. Please call me.",
    hi
      ? "आपदा सेतु में तैयार मसौदा। ऐप ने आपातकालीन सेवा से संपर्क नहीं किया है।"
      : "Draft prepared with AAPDA SETU. The app has not contacted emergency services.",
  ];
  if (opts.includeMedical) {
    lines.push(`${p.name || "—"} · ${p.age ?? "—"} · ${p.bloodType || "—"}`);
    if (reason) lines.push(`${reason.label}: ${reason.reading}`);
    lines.push(
      `Conditions / स्थितियाँ: ${p.conditions.join(", ") || "—"}. Allergies / एलर्जी: ${p.allergies.join(", ") || "—"}. Medicines / दवाएँ: ${p.medications.join(", ") || "—"}.`,
    );
  }
  if (opts.includeLocation && fix) {
    const stale = Date.now() - fix.at > STALE_FIX_MS;
    lines.push(
      `${mapsLink(fix)} (±${Math.round(fix.accuracy)} m; ${clockTime(fix.at)}${stale ? " — OUT OF DATE / पुराना; confirm by phone" : ""})`,
    );
  }
  return lines.join("\n");
}

const digits = (phone: string) => phone.replace(/[^\d+]/g, "");

const isApple = () =>
  typeof navigator !== "undefined" && /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);

export function smsHref(phones: string[], body: string) {
  const to = phones.map(digits).join(",");
  return `sms:${to}${isApple() ? "&" : "?"}body=${encodeURIComponent(body)}`;
}

export const telHref = (phone: string) => `tel:${digits(phone)}`;

/** Dial codes and expected national digit counts for countries we list. */
const COUNTRY_DIAL: Record<string, { dial: string; national: number[] }> = {
  IN: { dial: "91", national: [10] },
  US: { dial: "1", national: [10] },
  GB: { dial: "44", national: [10] },
  AU: { dial: "61", national: [9] },
};

/** Country-aware phone validation. Unknown countries fall back to a generic 3–15 digit check. */
export function isValidPhone(phone: string, countryCode?: string) {
  const raw = digits(phone).replace(/^\+/, "");
  if (!/^\d{3,15}$/.test(raw)) return false;
  const c = countryCode ? COUNTRY_DIAL[countryCode] : undefined;
  if (!c) return true;
  if (raw.startsWith(c.dial)) return c.national.includes(raw.length - c.dial.length);
  return c.national.includes(raw.length);
}
