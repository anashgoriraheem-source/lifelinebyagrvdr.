import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Twilio adapter for the alert dispatcher. Server-only.
 *
 * Credentials arrive through the platform's managed env file (never the repo,
 * never the browser): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * (voice + SMS sender) or TWILIO_MESSAGING_SERVICE_SID for SMS, plus
 * ALERT_PUBLIC_BASE_URL so status and keypad callbacks can reach this app.
 *
 * Nothing here invents an outcome: a request that Twilio rejects throws
 * ProviderError and the caller stores `failed` with the provider's message.
 */

export interface AlertProviderConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  messagingServiceSid: string;
  publicBaseUrl: string;
  /** The single number test mode is allowed to contact. */
  testPhone: string;
  tickSecret: string;
  sms: boolean;
  voice: boolean;
  configured: boolean;
  missing: string[];
}

const clean = (value: string | undefined) => (value ?? "").trim();

export function alertProviderConfig(): AlertProviderConfig {
  const accountSid = clean(process.env.TWILIO_ACCOUNT_SID);
  const authToken = clean(process.env.TWILIO_AUTH_TOKEN);
  const fromNumber = clean(process.env.TWILIO_FROM_NUMBER);
  const messagingServiceSid = clean(process.env.TWILIO_MESSAGING_SERVICE_SID);
  const publicBaseUrl = clean(process.env.ALERT_PUBLIC_BASE_URL).replace(/\/+$/, "");
  const testPhone = clean(process.env.ALERT_TEST_PHONE);
  const tickSecret = clean(process.env.ALERT_TICK_SECRET);

  const credentials = Boolean(accountSid && authToken);
  const sms = credentials && Boolean(messagingServiceSid || fromNumber);
  const voice = credentials && Boolean(fromNumber);
  const missing: string[] = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!fromNumber && !messagingServiceSid) missing.push("TWILIO_FROM_NUMBER");
  if (!fromNumber) missing.push("TWILIO_FROM_NUMBER (voice calls)");
  if (!publicBaseUrl) missing.push("ALERT_PUBLIC_BASE_URL");

  return {
    accountSid,
    authToken,
    fromNumber,
    messagingServiceSid,
    publicBaseUrl,
    testPhone,
    tickSecret,
    sms,
    voice,
    configured: sms && voice && Boolean(publicBaseUrl),
    missing,
  };
}

export class ProviderError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "ProviderError";
  }
}

const api = (cfg: AlertProviderConfig, path: string) =>
  `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/${path}`;

const authHeader = (cfg: AlertProviderConfig) =>
  `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`;

async function post(
  cfg: AlertProviderConfig,
  path: string,
  form: Record<string, string>,
): Promise<{ sid: string; providerStatus: string }> {
  let response: Response;
  try {
    response = await fetch(api(cfg, path), {
      method: "POST",
      headers: {
        Authorization: authHeader(cfg),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ProviderError("network", "The provider could not be reached.");
  }
  const payload = (await response.json().catch(() => null)) as {
    sid?: string;
    status?: string;
    code?: number;
    message?: string;
  } | null;
  if (!response.ok || !payload?.sid) {
    const reason = payload?.message || `Provider rejected the request (HTTP ${response.status}).`;
    throw new ProviderError(payload?.code ? String(payload.code) : `http-${response.status}`, reason);
  }
  return { sid: payload.sid, providerStatus: payload.status ?? "queued" };
}

export interface SendSmsInput {
  to: string;
  body: string;
  /** Correlation carried back on the status callback. */
  incidentId: string;
}

export async function sendSms(cfg: AlertProviderConfig, input: SendSmsInput) {
  if (!cfg.sms) throw new ProviderError("not-configured", "SMS is not configured.");
  const statusCallback = `${cfg.publicBaseUrl}/api/alerts/twilio/status?i=${encodeURIComponent(input.incidentId)}`;
  return post(cfg, "Messages.json", {
    To: input.to,
    Body: input.body,
    StatusCallback: statusCallback,
    ...(cfg.messagingServiceSid
      ? { MessagingServiceSid: cfg.messagingServiceSid }
      : { From: cfg.fromNumber }),
  });
}

export interface PlaceCallInput {
  to: string;
  twiml: string;
  incidentId: string;
}

export async function placeCall(cfg: AlertProviderConfig, input: PlaceCallInput) {
  if (!cfg.voice) throw new ProviderError("not-configured", "Voice calls are not configured.");
  const statusCallback = `${cfg.publicBaseUrl}/api/alerts/twilio/status?i=${encodeURIComponent(input.incidentId)}`;
  return post(cfg, "Calls.json", {
    To: input.to,
    From: cfg.fromNumber,
    Twiml: input.twiml,
    Timeout: "20",
    StatusCallback: statusCallback,
    StatusCallbackEvent: "initiated ringing answered completed",
  });
}

/** Best effort: stop an active call when the incident is canceled. */
export async function endCall(cfg: AlertProviderConfig, sid: string) {
  if (!cfg.configured) return;
  try {
    await fetch(api(cfg, `Calls/${encodeURIComponent(sid)}.json`), {
      method: "POST",
      headers: {
        Authorization: authHeader(cfg),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ Status: "completed" }).toString(),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    /* The provider will time the call out on its own; nothing to retry here. */
  }
}

/** Absolute URL for the keypad acknowledgement that Twilio fetches. */
export function acknowledgeUrl(
  cfg: AlertProviderConfig,
  incidentId: string,
  attemptId: string,
): string {
  const query = new URLSearchParams({ i: incidentId, a: attemptId });
  return `${cfg.publicBaseUrl}/api/alerts/twilio/ack?${query.toString()}`;
}

/**
 * Twilio's X-Twilio-Signature: HMAC-SHA1 over the full URL plus every POST
 * parameter (sorted by name, value appended directly), base64-encoded.
 */
export function computeTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const payload = Object.keys(params)
    .sort()
    .reduce((acc, key) => acc + key + params[key], url);
  return createHmac("sha1", authToken).update(payload, "utf8").digest("base64");
}

/** Constant-time comparison so a bad signature cannot be probed byte by byte. */
export function verifyTwilioSignature(input: {
  authToken: string;
  url: string;
  params: Record<string, string>;
  signature: string | null;
}): boolean {
  if (!input.authToken || !input.signature) return false;
  const expected = computeTwilioSignature(input.authToken, input.url, input.params);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The URL Twilio signed: the public base plus the request path and query. */
export function signedUrl(publicBaseUrl: string, requestUrl: string): string {
  try {
    const incoming = new URL(requestUrl);
    return `${publicBaseUrl.replace(/\/+$/, "")}${incoming.pathname}${incoming.search}`;
  } catch {
    return requestUrl;
  }
}
