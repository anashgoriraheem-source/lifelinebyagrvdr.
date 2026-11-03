/**
 * Wording and state rules for automatic alerts. Pure functions only, so the
 * same text decides what a contact reads in an SMS and hears in a call, and so
 * every rule is unit-testable without a provider.
 *
 * Safety rules encoded here:
 * - The message carries only what someone needs to act: who, what happened,
 *   when, and (if the person consented) a location link with its accuracy and
 *   age. No readings, conditions, medication or other medical history.
 * - A location older than `ALERT_LOCATION_STALE_MS` is labeled stale, never
 *   presented as current, and an absent fix says "location unavailable".
 * - A provider "accepted"/"queued"/"sent" state is never reported as delivered,
 *   and an answered call is never reported as acknowledged.
 */

export type AlertTriggerType = "sos" | "vital" | "fall" | "jolt" | "stillness";

export interface AlertLocation {
  lat: number;
  lng: number;
  accuracy: number;
  /** Epoch milliseconds of the fix. */
  at: number;
}

export interface AlertMessageInput {
  identity: string;
  triggerLabel: string;
  /** Epoch ms of the alarm. */
  startedAt: number;
  location: AlertLocation | null;
  includeLocation: boolean;
  testMode: boolean;
  /** Epoch ms used to judge staleness. Injectable for tests. */
  now?: number;
}

export const ALERT_LOCATION_STALE_MS = 10 * 60_000;

export const alertMapsLink = (loc: AlertLocation) =>
  `https://maps.google.com/?q=${loc.lat.toFixed(6)},${loc.lng.toFixed(6)}`;

export function alertClock(at: number, timeZone?: string) {
  return new Date(at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  });
}

/** One sentence describing the fix's honesty, used in SMS and the call script. */
export function describeLocation(
  location: AlertLocation | null,
  includeLocation: boolean,
  now = Date.now(),
): string {
  if (!includeLocation) return "Location was not included.";
  if (!location) return "Location unavailable.";
  const stale = now - location.at > ALERT_LOCATION_STALE_MS;
  const accuracy = Math.round(location.accuracy);
  return `${alertMapsLink(location)} (accuracy about ${accuracy} m, last updated ${alertClock(location.at)}${stale ? " — OUT OF DATE, confirm by phone" : ""})`;
}

/** The SMS body. Kept short and free of medical detail on purpose. */
export function alertSmsBody(input: AlertMessageInput): string {
  const who = input.identity.trim() || "A Lifeline user";
  const lines = [
    input.testMode ? "[Lifeline TEST — no real emergency]" : "Lifeline emergency alert",
    `${who} triggered a ${input.triggerLabel.toLowerCase()} at ${alertClock(input.startedAt)}.`,
    "Please call them now and check they are safe.",
    describeLocation(input.location, input.includeLocation, input.now ?? Date.now()),
  ];
  if (!input.testMode) {
    lines.push("This is an automated message from Lifeline. Reply or call back.");
  }
  return lines.join("\n");
}

/**
 * Spoken script for the automated voice call. A keypad press is the only
 * acknowledgement Lifeline accepts; an answered call alone is not consent that
 * somebody is helping.
 */
export function alertCallScript(input: AlertMessageInput): string {
  const who = input.identity.trim() || "A Lifeline user";
  const location = describeLocation(input.location, input.includeLocation, input.now ?? Date.now());
  return [
    input.testMode
      ? "This is a test call from Lifeline. No action is needed."
      : "This is an automated emergency alert from Lifeline.",
    `${who} triggered a ${input.triggerLabel.toLowerCase()} at ${alertClock(input.startedAt)}.`,
    input.includeLocation
      ? `They shared their location: ${location}.`
      : "They chose not to share their location.",
    "Press 1 on your keypad to confirm you are responding.",
  ].join(" ");
}

const xml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * TwiML for the automated call: say the alert, then wait for one keypad digit.
 * The acknowledgement URL is absolute because Twilio's servers fetch it.
 */
export function alertTwiml(script: string, acknowledgeUrl: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    `<Say voice="alice">${xml(script)}</Say>`,
    `<Gather numDigits="1" timeout="10" method="POST" action="${xml(acknowledgeUrl)}">`,
    '<Say voice="alice">Press 1 to confirm you are responding. Press 2 to stop further calls.</Say>',
    "</Gather>",
    '<Say voice="alice">No key was pressed. Goodbye.</Say>',
    "</Response>",
  ].join("");
}

/** TwiML returned after the contact presses a key. */
export function ackTwiml(acknowledged: boolean, stopCalls: boolean): string {
  const line = stopCalls
    ? "Thank you. Lifeline will not call you again for this alert."
    : acknowledged
      ? "Thank you. Lifeline has recorded that you are responding."
      : "No acknowledgement was recorded. Goodbye.";
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${xml(line)}</Say><Hangup/></Response>`;
}

export type AttemptStatus =
  | "queued"
  | "simulated"
  | "provider-accepted"
  | "delivered"
  | "call-initiated"
  | "ringing"
  | "answered"
  | "acknowledged"
  | "failed"
  | "unavailable"
  | "canceled";

export const ATTEMPT_STATE_LABEL: Record<AttemptStatus, string> = {
  queued: "Queued",
  simulated: "Test only — not sent",
  "provider-accepted": "Accepted by provider — delivery not yet confirmed",
  delivered: "Delivered — confirmed by provider",
  "call-initiated": "Call initiated",
  ringing: "Call ringing",
  answered: "Call answered — no confirmation yet",
  acknowledged: "Contact pressed 1 — acknowledged",
  failed: "Attempt failed",
  unavailable: "Not sent — setup incomplete",
  canceled: "Canceled before sending",
};

export interface ProviderStatusResult {
  status: AttemptStatus;
  answered: boolean;
  acknowledged: boolean;
  error?: string;
}

/**
 * Map a Twilio status callback onto Lifeline's vocabulary without upgrading a
 * weaker state: "sent"/"accepted" stay accepted, only "delivered" is delivered,
 * and a completed call only counts as answered when it actually had duration.
 */
export function classifyProviderStatus(
  channel: "sms" | "call",
  providerStatus: string,
  extra: { answeredBy?: string; durationSeconds?: number } = {},
): ProviderStatusResult {
  const s = providerStatus.toLowerCase();
  if (channel === "sms") {
    if (s === "delivered" || s === "read") {
      return { status: "delivered", answered: false, acknowledged: false };
    }
    if (["queued", "accepted", "scheduled", "sending"].includes(s)) {
      return { status: "provider-accepted", answered: false, acknowledged: false };
    }
    if (["undelivered", "failed", "canceled"].includes(s)) {
      return {
        status: s === "canceled" ? "canceled" : "failed",
        answered: false,
        acknowledged: false,
        error: s === "undelivered" ? "Provider reported undelivered" : `Provider reported ${s}`,
      };
    }
    return { status: "provider-accepted", answered: false, acknowledged: false };
  }
  if (s === "ringing") return { status: "ringing", answered: false, acknowledged: false };
  if (s === "in-progress" || s === "answered") {
    return {
      status: extra.answeredBy === "machine_start" ? "ringing" : "answered",
      answered: extra.answeredBy !== "machine_start",
      acknowledged: false,
    };
  }
  if (s === "completed") {
    const answered = (extra.durationSeconds ?? 0) > 0;
    return {
      status: answered ? "answered" : "failed",
      answered,
      acknowledged: false,
      error: answered ? undefined : "Call completed without being answered",
    };
  }
  if (["queued", "initiated"].includes(s)) {
    return { status: "call-initiated", answered: false, acknowledged: false };
  }
  if (["busy", "no-answer", "failed", "canceled"].includes(s)) {
    return {
      status: s === "canceled" ? "canceled" : "failed",
      answered: false,
      acknowledged: false,
      error: `Provider reported ${s}`,
    };
  }
  return { status: "call-initiated", answered: false, acknowledged: false };
}
