import {
  alertCallScript,
  alertMapsLink,
  alertSmsBody,
  alertTwiml,
  ackTwiml,
  classifyProviderStatus,
  type AlertLocation,
  type AttemptStatus,
} from "./alertMessage";
import {
  acknowledgeUrl,
  alertProviderConfig,
  endCall,
  placeCall,
  sendSms,
  type AlertProviderConfig,
} from "./alertProvider.server";
import { serviceClient } from "./supabaseService.server";
import type { AttemptView, DispatchView } from "./alertTypes";

/**
 * Durable alert dispatcher.
 *
 * One alarm becomes exactly one `alert_events` row (unique per user and
 * idempotency key) with one `alert_attempts` row per contact and channel, plus
 * an append-only `alert_incident_events` timeline. Every provider request is
 * claimed with a conditional UPDATE first, so a replay or two concurrent ticks
 * cannot send the same message or place the same call twice.
 *
 * The status written is always what the provider reported: `provider-accepted`
 * for an accepted SMS, `ringing`/`answered` for call progress, `delivered` only
 * from a delivery callback, and `acknowledged` only from the keypad.
 *
 * Durability honesty: the countdown expiry and the call escalation are advanced
 * by (a) the caller that started the incident, (b) the open page's polling, and
 * (c) `/api/alerts/tick`, which a scheduled job or cron must call with
 * ALERT_TICK_SECRET for progression with nobody watching.
 */

type Sb = ReturnType<typeof serviceClient>;
const sb = () => serviceClient() as unknown as {
  from: (table: string) => any;
};

export interface AlertSettingsRow {
  identity_name: string;
  automation_enabled: boolean;
  test_mode: boolean;
  triggers: string[];
  countdown_seconds: number;
  include_location: boolean;
  escalate_after_seconds: number;
  max_rounds: number;
  consent_at: string | null;
}

export interface ContactRow {
  id: string;
  name: string;
  phone: string;
  call: boolean;
  sms: boolean;
  position: number;
  automation_consent: boolean;
}

const FINAL = new Set(["acknowledged", "resolved", "canceled", "failed", "blocked"]);
const isFinal = (s: string) => FINAL.has(s);
const nowIso = () => new Date().toISOString();

async function timeline(eventId: string, userId: string, kind: string, detail = "") {
  await sb()
    .from("alert_incident_events")
    .insert({ event_id: eventId, user_id: userId, kind, detail: detail.slice(0, 500) });
}

export interface CreateIncidentInput {
  userId: string;
  idempotencyKey: string;
  reasonType: "sos" | "vital" | "fall" | "jolt" | "stillness";
  reasonLabel: string;
  reasonReading: string;
  isDemo: boolean;
  startedAt: number;
  location: AlertLocation | null;
  locationSource: "gps" | "none";
  settings: AlertSettingsRow;
}

/** Idempotent incident creation. A replay returns the row already stored. */
export async function createOrGetIncident(input: CreateIncidentInput) {
  const db = sb();
  const countdown = Math.max(0, input.settings.countdown_seconds);
  const cancelDeadline =
    input.reasonType === "sos" || countdown === 0
      ? null
      : new Date(input.startedAt + countdown * 1000).toISOString();
  const status = cancelDeadline && Date.parse(cancelDeadline) > Date.now() ? "countdown" : "queued";

  const row = {
    user_id: input.userId,
    idempotency_key: input.idempotencyKey,
    // A demo/simulated event can never reach a real contact, even when the
    // saved settings are live: it is stored as a test incident instead.
    mode: input.settings.test_mode || input.isDemo ? "test" : "live",
    reason_type: input.reasonType,
    reason_label: input.reasonLabel.slice(0, 200),
    reason_reading: input.reasonReading.slice(0, 300),
    is_demo: input.isDemo,
    started_at: new Date(input.startedAt).toISOString(),
    status,
    cancel_deadline: cancelDeadline,
    lat: input.location?.lat ?? null,
    lng: input.location?.lng ?? null,
    accuracy: input.location?.accuracy ?? null,
    location_at: input.location ? new Date(input.location.at).toISOString() : null,
    location_source: input.location ? input.locationSource : "none",
    settings_snapshot: {
      identity_name: input.settings.identity_name,
      include_location: input.settings.include_location,
      countdown_seconds: countdown,
      escalate_after_seconds: input.settings.escalate_after_seconds,
      max_rounds: input.settings.max_rounds,
      triggers: input.settings.triggers,
      test_mode: input.settings.test_mode || input.isDemo,
    },
    updated_at: nowIso(),
  };

  const inserted = await db.from("alert_events").insert(row).select().single();
  if (inserted.data) {
    await timeline(inserted.data.id, input.userId, "incident-created", `Triggered by ${input.reasonType}`);
    return inserted.data;
  }
  const existing = await db
    .from("alert_events")
    .select()
    .eq("user_id", input.userId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();
  if (!existing.data) throw new Error("The incident could not be stored.");
  return existing.data;
}

async function loadIncident(eventId: string) {
  const { data } = await sb().from("alert_events").select().eq("id", eventId).maybeSingle();
  return data as Record<string, any> | null;
}

/** One row per consented contact and channel, created once and never repeated. */
async function ensureAttempts(incident: Record<string, any>) {
  const db = sb();
  const { data: existing } = await db.from("alert_attempts").select("id").eq("event_id", incident.id);
  if (existing && existing.length > 0) return;

  const { data: contacts } = await db
    .from("contacts")
    .select("id, name, phone, call, sms, position, automation_consent")
    .eq("user_id", incident.user_id)
    .eq("automation_consent", true)
    .order("position");

  const planned: Record<string, unknown>[] = [];
  let order = 0;
  for (const c of (contacts ?? []) as ContactRow[]) {
    if (c.sms) {
      planned.push({
        event_id: incident.id,
        user_id: incident.user_id,
        contact_id: c.id,
        contact_name: c.name,
        channel: "sms",
        provider: "pending",
        status: "queued",
        order_index: order++,
      });
    }
    if (c.call) {
      planned.push({
        event_id: incident.id,
        user_id: incident.user_id,
        contact_id: c.id,
        contact_name: c.name,
        channel: "call",
        provider: "pending",
        status: "queued",
        order_index: order++,
      });
    }
  }
  if (planned.length === 0) {
    await timeline(incident.id, incident.user_id, "no-consented-contacts", "Nobody has consented to automated alerts.");
    return;
  }
  await db
    .from("alert_attempts")
    .upsert(planned, { onConflict: "event_id,contact_id,channel", ignoreDuplicates: true });
}

/** Claim a queued attempt before contacting the provider. */
async function claimAttempt(attemptId: string) {
  const { data } = await sb()
    .from("alert_attempts")
    .update({ status: "queued", attempted_at: nowIso(), updated_at: nowIso() })
    .eq("id", attemptId)
    .eq("status", "queued")
    .select()
    .maybeSingle();
  return data as Record<string, any> | null;
}

async function setAttempt(
  attemptId: string,
  patch: Record<string, unknown>,
  eventId: string,
  userId: string,
  detail?: string,
) {
  await sb()
    .from("alert_attempts")
    .update({ ...patch, updated_at: nowIso() })
    .eq("id", attemptId);
  if (detail) {
    const { data } = await sb().from("alert_attempts").select("channel, contact_name, status").eq("id", attemptId).maybeSingle();
    await timeline(eventId, userId, detail, `${data?.contact_name ?? ""} · ${data?.channel ?? ""} · ${data?.status ?? ""}`);
  }
}

function contactPhone(incident: Record<string, any>, attempt: Record<string, any>) {
  return attempt.contact_phone as string | undefined;
}

/**
 * A queue entry stores no phone number, so it is looked up from the contact at
 * send time. A contact removed after the alarm is reported as unavailable
 * rather than silently skipped.
 */
async function phoneFor(attempt: Record<string, any>): Promise<string | null> {
  if (!attempt.contact_id) return null;
  const { data } = await sb().from("contacts").select("phone").eq("id", attempt.contact_id).maybeSingle();
  return data?.phone ?? null;
}

function messageInput(incident: Record<string, any>, testMode: boolean) {
  const snap = (incident.settings_snapshot ?? {}) as Record<string, any>;
  return {
    identity: String(snap.identity_name ?? ""),
    triggerLabel: String(incident.reason_label ?? "emergency alert"),
    startedAt: Date.parse(incident.started_at),
    location:
      incident.lat != null && incident.lng != null
        ? {
            lat: incident.lat,
            lng: incident.lng,
            accuracy: incident.accuracy ?? 0,
            at: incident.location_at ? Date.parse(incident.location_at) : Date.parse(incident.started_at),
          }
        : null,
    includeLocation: Boolean(snap.include_location),
    testMode,
  };
}

async function dispatchSms(
  incident: Record<string, any>,
  attempt: Record<string, any>,
  cfg: AlertProviderConfig,
  { simulate, testTarget }: { simulate: boolean; testTarget: boolean },
) {
  const claimed = await claimAttempt(attempt.id);
  if (!claimed) return;
  if (simulate) {
    await setAttempt(
      attempt.id,
      { status: "simulated", provider: "test-sandbox", provider_status: "not-sent" },
      incident.id,
      incident.user_id,
      "sms-simulated",
    );
    return;
  }
  const phone = testTarget ? cfg.testPhone : await phoneFor(claimed);
  if (!phone) {
    await setAttempt(
      attempt.id,
      { status: "unavailable", provider: "twilio", error: "Contact removed or has no number" },
      incident.id,
      incident.user_id,
      "sms-unavailable",
    );
    return;
  }
  try {
    const body = alertSmsBody(messageInput(incident, testTarget));
    const result = await sendSms(cfg, { to: phone, body, incidentId: incident.id });
    await setAttempt(
      attempt.id,
      {
        status: "provider-accepted",
        provider: testTarget ? "twilio-test" : "twilio",
        provider_sid: result.sid,
        provider_status: result.providerStatus,
        error: null,
      },
      incident.id,
      incident.user_id,
      "sms-accepted-by-provider",
    );
  } catch (error) {
    await setAttempt(
      attempt.id,
      {
        status: "failed",
        provider: "twilio",
        error: error instanceof Error ? error.message.slice(0, 400) : "Provider error",
      },
      incident.id,
      incident.user_id,
      "sms-failed",
    );
  }
}

async function dispatchCall(
  incident: Record<string, any>,
  attempt: Record<string, any>,
  cfg: AlertProviderConfig,
  { simulate, testTarget }: { simulate: boolean; testTarget: boolean },
) {
  const claimed = await claimAttempt(attempt.id);
  if (!claimed) return false;
  if (simulate) {
    await setAttempt(
      attempt.id,
      { status: "simulated", provider: "test-sandbox", provider_status: "not-sent" },
      incident.id,
      incident.user_id,
      "call-simulated",
    );
    return false;
  }
  const phone = testTarget ? cfg.testPhone : await phoneFor(claimed);
  if (!phone) {
    await setAttempt(
      attempt.id,
      { status: "unavailable", provider: "twilio", error: "Contact removed or has no number" },
      incident.id,
      incident.user_id,
      "call-unavailable",
    );
    return false;
  }
  try {
    const twiml = alertTwiml(
      alertCallScript(messageInput(incident, testTarget)),
      acknowledgeUrl(cfg, incident.id, attempt.id),
    );
    const result = await placeCall(cfg, { to: phone, twiml, incidentId: incident.id });
    await setAttempt(
      attempt.id,
      {
        status: "call-initiated",
        provider: testTarget ? "twilio-test" : "twilio",
        provider_sid: result.sid,
        provider_status: result.providerStatus,
        error: null,
      },
      incident.id,
      incident.user_id,
      "call-initiated",
    );
    return true;
  } catch (error) {
    await setAttempt(
      attempt.id,
      {
        status: "failed",
        provider: "twilio",
        error: error instanceof Error ? error.message.slice(0, 400) : "Provider error",
      },
      incident.id,
      incident.user_id,
      "call-failed",
    );
    return false;
  }
}

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Server-side continuation for a countdown: if the tab closes, the alert still
 * goes out while this server process lives. `api/alerts/tick` covers a restart.
 */
export function scheduleFollowUp(eventId: string, at: number) {
  const existing = timers.get(eventId);
  if (existing) clearTimeout(existing);
  const delay = Math.min(Math.max(at - Date.now(), 0) + 250, 5 * 60_000);
  const timer = setTimeout(() => {
    timers.delete(eventId);
    void pumpIncident(eventId).catch(() => {
      /* the incident stays queued and the tick route retries it */
    });
  }, delay);
  if (typeof timer.unref === "function") timer.unref();
  timers.set(eventId, timer);
}

/** Advance one incident as far as the current time allows. Safe to call often. */
export async function pumpIncident(eventId: string): Promise<void> {
  const incident = await loadIncident(eventId);
  if (!incident || isFinal(incident.status)) return;

  if (incident.status === "countdown") {
    const deadline = incident.cancel_deadline ? Date.parse(incident.cancel_deadline) : 0;
    if (deadline > Date.now()) {
      scheduleFollowUp(eventId, deadline);
      return;
    }
  }

  const claimed = await sb()
    .from("alert_events")
    .update({ status: "dispatching", dispatch_started_at: nowIso(), updated_at: nowIso() })
    .eq("id", eventId)
    .in("status", ["queued", "countdown"])
    .select("id");
  const fresh = await loadIncident(eventId);
  if (!fresh || isFinal(fresh.status)) return;

  const cfg = alertProviderConfig();
  const snap = (fresh.settings_snapshot ?? {}) as Record<string, any>;
  const testMode = fresh.mode === "test";
  const testTarget = testMode && Boolean(cfg.testPhone) && cfg.configured;
  const canSend = !testMode
    ? cfg.configured
    : testTarget;

  await ensureAttempts(fresh);

  if (!canSend) {
    const reason = testMode
      ? "Test mode: no designated test number is configured, so nothing was sent."
      : cfg.configured
        ? "Delivery is not available right now."
        : "The messaging provider is not configured.";
    await sb()
      .from("alert_attempts")
      .update({
        status: testMode ? "simulated" : "unavailable",
        provider: testMode ? "test-sandbox" : "none",
        error: testMode ? null : reason,
        updated_at: nowIso(),
      })
      .eq("event_id", eventId)
      .eq("status", "queued");
    await sb()
      .from("alert_events")
      .update({ status: testMode ? "blocked" : "blocked", last_error: reason, updated_at: nowIso() })
      .eq("id", eventId);
    await timeline(eventId, fresh.user_id, testMode ? "test-simulated" : "provider-unavailable", reason);
    return;
  }

  if (claimed.data?.length) {
    await timeline(eventId, fresh.user_id, "dispatch-started", testTarget ? "Test destination only" : "Live contacts");
  }

  // 1. Every text message goes out on the first pass.
  const { data: smsRows } = await sb()
    .from("alert_attempts")
    .select()
    .eq("event_id", eventId)
    .eq("channel", "sms")
    .eq("status", "queued")
    .order("order_index");
  for (const attempt of smsRows ?? []) {
    await dispatchSms(fresh, attempt, cfg, { simulate: false, testTarget });
  }

  await continueCalls(fresh, cfg, testTarget);
}

/** Call ordering and escalation: one active call at a time, bounded rounds. */
async function continueCalls(
  incident: Record<string, any>,
  cfg: AlertProviderConfig,
  testTarget: boolean,
) {
  const db = sb();
  const reload = await loadIncident(incident.id);
  if (!reload || isFinal(reload.status)) return;

  const { data: calls } = await db
    .from("alert_attempts")
    .select()
    .eq("event_id", incident.id)
    .eq("channel", "call")
    .order("order_index");

  if (!calls || calls.length === 0) {
    const { data: ackd } = await db
      .from("alert_attempts")
      .select("id")
      .eq("event_id", incident.id)
      .eq("status", "acknowledged");
    if (!ackd?.length) {
      await db
        .from("alert_events")
        .update({ status: "dispatching", updated_at: nowIso() })
        .eq("id", incident.id);
    }
    return;
  }

  const active = calls.find((c: any) => ["call-initiated", "ringing"].includes(c.status));
  const nextAt = reload.next_action_at ? Date.parse(reload.next_action_at) : 0;

  if (active) {
    if (Date.now() < nextAt) {
      scheduleFollowUp(incident.id, nextAt);
      return;
    }
    if (active.provider_sid && cfg.configured) await endCall(cfg, active.provider_sid);
    await setAttempt(
      active.id,
      {
        status: "failed",
        error: "No keypad acknowledgement within the escalation window",
        completed_at: nowIso(),
      },
      incident.id,
      incident.user_id,
      "call-no-acknowledgement",
    );
  }

  const acknowledged = calls.find((c: any) => c.status === "acknowledged");
  if (acknowledged) {
    await db
      .from("alert_events")
      .update({ status: "acknowledged", next_action_at: null, updated_at: nowIso() })
      .eq("id", incident.id);
    return;
  }

  const { data: freshCalls } = await db
    .from("alert_attempts")
    .select()
    .eq("event_id", incident.id)
    .eq("channel", "call")
    .order("order_index");
  const queued = (freshCalls ?? []).find((c: any) => c.status === "queued");

  if (queued) {
    const placed = await dispatchCall(reload, queued, cfg, { simulate: false, testTarget });
    if (!placed) {
      await continueCalls(reload, cfg, testTarget);
      return;
    }
    const escalateAt = Date.now() + Number(reload.settings_snapshot?.escalate_after_seconds ?? 45) * 1000;
    await db
      .from("alert_events")
      .update({
        status: "escalating",
        next_action_at: new Date(escalateAt).toISOString(),
        updated_at: nowIso(),
      })
      .eq("id", incident.id);
    await timeline(incident.id, incident.user_id, "escalation-progress", "Next contact if no acknowledgement");
    scheduleFollowUp(incident.id, escalateAt);
    return;
  }

  const maxRounds = Number(reload.settings_snapshot?.max_rounds ?? 2);
  const round = Number(reload.round ?? 1);
  if (round < maxRounds) {
    // Bounded retry: only calls that never reached a person are retried.
    await db
      .from("alert_attempts")
      .update({ status: "queued", error: null, updated_at: nowIso() })
      .eq("event_id", incident.id)
      .eq("channel", "call")
      .eq("status", "failed");
    await db
      .from("alert_events")
      .update({ status: "escalating", round: round + 1, last_error: "Retrying unanswered calls", updated_at: nowIso() })
      .eq("id", incident.id);
    await timeline(incident.id, incident.user_id, "escalation-retry", `Round ${round + 1} of ${maxRounds}`);
    await continueCalls(reload, cfg, testTarget);
    return;
  }

  await db
    .from("alert_events")
    .update({
      status: "failed",
      last_error: "No contact acknowledged the alert. Call the person or emergency services yourself.",
      next_action_at: null,
      updated_at: nowIso(),
    })
    .eq("id", incident.id);
  await timeline(incident.id, incident.user_id, "escalation-exhausted", "No acknowledgement after the last round");
}

export async function cancelIncident(input: {
  userId: string;
  eventId: string;
  reason: string;
}): Promise<DispatchView> {
  const db = sb();
  const incident = await loadIncident(input.eventId);
  if (!incident || incident.user_id !== input.userId) throw new Error("Incident not found.");
  if (isFinal(incident.status)) return readIncident(input.eventId, input.userId);

  const cfg = alertProviderConfig();
  const { data: active } = await db
    .from("alert_attempts")
    .select()
    .eq("event_id", input.eventId)
    .in("status", ["call-initiated", "ringing"]);
  for (const call of active ?? []) {
    if (call.provider_sid && cfg.configured) await endCall(cfg, call.provider_sid);
  }

  await db
    .from("alert_attempts")
    .update({ status: "canceled", completed_at: nowIso(), updated_at: nowIso() })
    .eq("event_id", input.eventId)
    .in("status", ["queued", "call-initiated", "ringing"]);
  await db
    .from("alert_events")
    .update({
      status: "canceled",
      canceled_at: nowIso(),
      next_action_at: null,
      last_error: input.reason.slice(0, 300),
      updated_at: nowIso(),
    })
    .eq("id", input.eventId);
  await timeline(input.eventId, input.userId, "canceled", input.reason);

  const timer = timers.get(input.eventId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(input.eventId);
  }
  return readIncident(input.eventId, input.userId);
}

/** Provider callback (verified in the route) updates exactly one attempt. */
export async function applyProviderStatus(input: {
  eventId: string;
  sid: string;
  providerStatus: string;
  answeredBy?: string;
  durationSeconds?: number;
}) {
  const db = sb();
  const { data: attempt } = await db
    .from("alert_attempts")
    .select()
    .eq("provider_sid", input.sid)
    .maybeSingle();
  if (!attempt || attempt.event_id !== input.eventId) return { found: false as const };

  const mapped = classifyProviderStatus(attempt.channel, input.providerStatus, {
    answeredBy: input.answeredBy,
    durationSeconds: input.durationSeconds,
  });
  // Never downgrade: an acknowledged attempt stays acknowledged, a delivered
  // message stays delivered when a late "sent" callback arrives.
  const keep = attempt.status === "acknowledged" || attempt.status === "delivered";
  const patch: Record<string, unknown> = {
    provider_status: input.providerStatus,
    updated_at: nowIso(),
  };
  if (!keep) {
    patch.status = mapped.status;
    if (mapped.status === "answered" && !attempt.answered_at) patch.answered_at = nowIso();
    if (mapped.status === "ringing") patch.status = "ringing";
    if (mapped.error) patch.error = mapped.error;
    if (["delivered", "failed", "canceled", "answered"].includes(mapped.status)) {
      patch.completed_at = nowIso();
    }
  }
  await db.from("alert_attempts").update(patch).eq("id", attempt.id);
  await timeline(
    attempt.event_id,
    attempt.user_id,
    `provider-${attempt.channel}-${input.providerStatus}`,
    `${attempt.contact_name}: ${attempt.status} → ${String(patch.status ?? attempt.status)}`,
  );

  const { data: incident } = await db
    .from("alert_events")
    .select("status")
    .eq("id", attempt.event_id)
    .maybeSingle();
  if (mapped.status === "answered" && incident?.status === "escalating") {
    // Answered is not acknowledged: keep escalating, but reflect progress.
    await db
      .from("alert_events")
      .update({ updated_at: nowIso() })
      .eq("id", attempt.event_id);
  }
  return { found: true as const, attemptId: attempt.id as string, status: attempt.status as string };
}

/** Keypad acknowledgement from the automated call. */
export async function acknowledgeAlert(input: {
  eventId: string;
  attemptId: string;
  stopCalls?: boolean;
}): Promise<{ acknowledged: boolean; message: string }> {
  const db = sb();
  const { data: attempt } = await db
    .from("alert_attempts")
    .select()
    .eq("id", input.attemptId)
    .eq("event_id", input.eventId)
    .maybeSingle();
  if (!attempt) return { acknowledged: false, message: ackTwiml(false, false) };

  if (input.stopCalls) {
    await db
      .from("alert_attempts")
      .update({ status: "answered", error: "Contact asked to stop further calls", completed_at: nowIso(), updated_at: nowIso() })
      .eq("id", attempt.id);
    await timeline(attempt.event_id, attempt.user_id, "contact-stopped-calls", attempt.contact_name);
    return { acknowledged: false, message: ackTwiml(false, true) };
  }

  if (attempt.status !== "acknowledged") {
    await db
      .from("alert_attempts")
      .update({
        status: "acknowledged",
        acknowledged_at: nowIso(),
        answered_at: attempt.answered_at ?? nowIso(),
        completed_at: nowIso(),
        updated_at: nowIso(),
      })
      .eq("id", attempt.id);
    await db
      .from("alert_events")
      .update({ status: "acknowledged", next_action_at: null, updated_at: nowIso() })
      .eq("id", input.eventId);
    await db
      .from("alert_attempts")
      .update({ status: "canceled", updated_at: nowIso() })
      .eq("event_id", input.eventId)
      .eq("status", "queued");
    await timeline(attempt.event_id, attempt.user_id, "contact-acknowledged", attempt.contact_name);
  }
  return { acknowledged: true, message: ackTwiml(true, false) };
}

export async function readIncident(eventId: string, userId?: string): Promise<DispatchView> {
  const db = sb();
  const incident = await loadIncident(eventId);
  if (!incident) throw new Error("Incident not found.");
  if (userId && incident.user_id !== userId) throw new Error("Incident not found.");

  const [{ data: attempts }, { data: events }] = await Promise.all([
    db.from("alert_attempts").select().eq("event_id", eventId).order("order_index"),
    db.from("alert_incident_events").select().eq("event_id", eventId).order("at"),
  ]);
  const cfg = alertProviderConfig();
  const mapped: AttemptView[] = (attempts ?? []).map((a: any) => ({
    id: a.id,
    channel: a.channel,
    contactName: a.contact_name,
    status: a.status,
    provider: a.provider,
    providerStatus: a.provider_status ?? null,
    error: a.error ?? null,
    order: a.order_index ?? 0,
    updatedAt: a.updated_at,
  }));

  return {
    eventId,
    status: ["canceled", "resolved"].includes(incident.status) ? "cancelled" : "active",
    mode: incident.mode,
    liveReady: cfg.configured,
    incidentStatus: incident.status,
    cancelDeadline: incident.cancel_deadline ? Date.parse(incident.cancel_deadline) : null,
    attempts: mapped,
    timeline: (events ?? []).map((e: any) => ({ kind: e.kind, detail: e.detail, at: e.at })),
    providerConfigured: cfg.configured,
    blockedReason: incident.last_error ?? null,
    round: Number(incident.round ?? 0),
    maxRounds: Number(incident.settings_snapshot?.max_rounds ?? 2),
    nextActionAt: incident.next_action_at ? Date.parse(incident.next_action_at) : null,
    updatedAt: incident.updated_at,
  };
}

/** Incidents a scheduled tick should look at (countdown expired or escalation due). */
export async function dueIncidentIds(limit = 25): Promise<string[]> {
  const db = sb();
  const { data } = await db
    .from("alert_events")
    .select("id, status, cancel_deadline, next_action_at")
    .in("status", ["queued", "countdown", "dispatching", "escalating"])
    .order("started_at", { ascending: false })
    .limit(limit);
  const now = Date.now();
  return (data ?? [])
    .filter((row: any) => {
      const deadline = row.cancel_deadline ? Date.parse(row.cancel_deadline) : 0;
      if (row.status === "countdown") return deadline <= now;
      if (row.next_action_at) return Date.parse(row.next_action_at) <= now;
      return true;
    })
    .map((row: any) => row.id as string);
}

export const alertLocationLink = alertMapsLink;
