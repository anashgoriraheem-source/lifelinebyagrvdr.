import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { alertProviderConfig } from "./alertProvider.server";
import {
  createOrGetIncident,
  pumpIncident,
  readIncident,
  scheduleFollowUp,
  type AlertSettingsRow,
} from "./alertDispatch.server";
import type { AlertSetupView, DispatchView, ProviderStatusView } from "./alertTypes";

export type { AlertSetupView, AttemptView, DispatchView, ProviderStatusView, TimelineView } from "./alertTypes";

/**
 * Server functions for automatic alerts. Authentication is always the bearer
 * token (never a browser-supplied user id), and the dispatch itself runs on the
 * server with the service role, so closing the tab does not cancel the work
 * that has already been accepted.
 */

export const getProviderStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ProviderStatusView> => {
    const cfg = alertProviderConfig();
    const missing = [...new Set(cfg.missing)];
    return {
      mode: "live",
      liveReady: cfg.configured,
      sms: cfg.sms,
      voice: cfg.voice,
      email: false,
      testDestinationConfigured: Boolean(cfg.testPhone),
      missing,
      policySteps: [
        "Add Twilio credentials and a sending number in the app secrets, plus ALERT_PUBLIC_BASE_URL so delivery and keypad callbacks can reach this app.",
        "In India, TRAI/telecom rules apply to automated SMS and voice: register the sender, get message templates approved and check consent requirements for the exact use case. Do not assume an emergency exemption.",
        "Set a designated ALERT_TEST_PHONE. Test mode can only contact that number, never your real contacts.",
      ],
    };
  },
);

const triggerSchema = z.enum(["sos", "vital", "fall", "jolt"]);

export const getAlertSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AlertSetupView> => {
    const [settings, contacts, recent] = await Promise.all([
      context.supabase.from("alert_settings").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase
        .from("contacts")
        .select("*")
        .eq("user_id", context.userId)
        .order("position"),
      context.supabase
        .from("alert_events")
        .select("id, started_at, status, mode, reason_label, last_error")
        .eq("user_id", context.userId)
        .order("started_at", { ascending: false })
        .limit(10),
    ]);
    if (settings.error || contacts.error || recent.error)
      throw new Error("Your alert setup could not be loaded. Try again.");
    const row = settings.data;
    return {
      settings: row
        ? {
            identityName: row.identity_name ?? "",
            automationEnabled: row.automation_enabled,
            testMode: row.test_mode,
            triggers: row.triggers ?? ["sos"],
            countdownSeconds: row.countdown_seconds,
            includeLocation: row.include_location,
            escalateAfterSeconds: row.escalate_after_seconds,
            maxRounds: row.max_rounds,
            consentAt: row.consent_at,
          }
        : null,
      contacts: (contacts.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        relationship: c.relationship,
        phone: c.phone,
        email: c.email ?? "",
        emailAlerts: Boolean(c.email_alerts),
        confirmedAt: c.confirmed_at,
        testDestination: c.test_destination !== false,
        call: c.call,
        sms: c.sms,
        position: c.position,
        automationConsent: Boolean(c.automation_consent),
        consentAt: c.consent_at ?? null,
        consentNote: c.consent_note ?? "",
      })),
      provider: await getProviderStatus(),
      recent: (recent.data ?? []).map((r) => ({
        id: r.id,
        startedAt: r.started_at,
        status: (r as { status?: string }).status ?? "queued",
        mode: r.mode,
        reasonLabel: r.reason_label,
        lastError: (r as { last_error?: string | null }).last_error ?? null,
      })),
    };
  });

const settingsSchema = z.object({
  identityName: z.string().trim().max(120),
  automationEnabled: z.boolean(),
  testMode: z.boolean(),
  triggers: z.array(triggerSchema).min(1).max(4),
  countdownSeconds: z.number().int().min(0).max(60),
  includeLocation: z.boolean(),
  escalateAfterSeconds: z.number().int().min(15).max(300),
  maxRounds: z.number().int().min(1).max(3),
  consent: z.boolean(),
});

export const saveAlertSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => settingsSchema.parse(data))
  .handler(async ({ context, data }) => {
    if (data.automationEnabled && !data.consent) {
      throw new Error("Tick the consent box before turning automatic alerts on.");
    }
    const cfg = alertProviderConfig();
    if (data.automationEnabled && !data.testMode && !cfg.configured) {
      throw new Error(
        "Live delivery is not configured yet. Keep test mode on until the messaging provider is set up.",
      );
    }
    const { data: consented, error: contactError } = await context.supabase
      .from("contacts")
      .select("id")
      .eq("user_id", context.userId)
      .eq("automation_consent", true)
      .limit(1);
    if (contactError) throw new Error("Your contacts could not be checked. Try again.");
    if (data.automationEnabled && !(consented ?? []).length) {
      throw new Error("At least one contact must have recorded consent before alerts can be enabled.");
    }

    const existing = await context.supabase
      .from("alert_settings")
      .select("consent_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const consentAt = data.automationEnabled
      ? ((existing.data as { consent_at?: string | null } | null)?.consent_at ?? new Date().toISOString())
      : null;

    const { error } = await context.supabase.from("alert_settings").upsert({
      user_id: context.userId,
      identity_name: data.identityName,
      automation_enabled: data.automationEnabled,
      test_mode: data.testMode,
      triggers: data.triggers,
      countdown_seconds: data.countdownSeconds,
      include_location: data.includeLocation,
      escalate_after_seconds: data.escalateAfterSeconds,
      max_rounds: data.maxRounds,
      consent_at: consentAt,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Alert settings were not saved. Try again.");
    return { ok: true as const, consentAt };
  });

const locationSchema = z
  .object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    accuracy: z.number().min(0).max(100_000),
    at: z.number().int().positive(),
  })
  .nullable();

const triggerInput = z.object({
  idempotencyKey: z.string().min(1).max(200),
  reasonType: triggerSchema,
  reasonLabel: z.string().min(1).max(200),
  reasonReading: z.string().max(300),
  isDemo: z.boolean(),
  startedAt: z.number().int().positive(),
  location: locationSchema,
});

async function settingsFor(userId: string, supabase: { from: (t: string) => any }) {
  const { data } = await supabase.from("alert_settings").select("*").eq("user_id", userId).maybeSingle();
  return (data ?? null) as AlertSettingsRow | null;
}

export const dispatchEmergency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => triggerInput.parse(data))
  .handler(async ({ context, data }): Promise<DispatchView | null> => {
    const settings = await settingsFor(context.userId, context.supabase);
    // No opt-in means no automation: the alarm keeps its manual call and
    // message actions, and nothing is sent to anybody.
    if (!settings || !settings.automation_enabled) return null;
    if (!settings.triggers.includes(data.reasonType)) return null;

    const incident = await createOrGetIncident({
      userId: context.userId,
      idempotencyKey: data.idempotencyKey,
      reasonType: data.reasonType,
      reasonLabel: data.reasonLabel,
      reasonReading: data.reasonReading,
      isDemo: data.isDemo,
      startedAt: data.startedAt,
      location: data.location,
      locationSource: data.location ? "gps" : "none",
      settings,
    });

    if (incident.status === "countdown" && incident.cancel_deadline) {
      scheduleFollowUp(incident.id, Date.parse(incident.cancel_deadline));
    } else {
      await pumpIncident(incident.id);
    }
    return readIncident(incident.id, context.userId);
  });

const incidentInput = z.object({ eventId: z.string().uuid() });

export const getDispatchState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => incidentInput.parse(data))
  .handler(async ({ context, data }) => readIncident(data.eventId, context.userId));

/** Advance countdown expiry and call escalation. Idempotent server-side. */
export const advanceDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => incidentInput.parse(data))
  .handler(async ({ context, data }) => {
    await pumpIncident(data.eventId);
    return readIncident(data.eventId, context.userId);
  });

export const cancelDispatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    incidentInput.extend({ reason: z.string().max(300) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const { cancelIncident } = await import("./alertDispatch.server");
    return cancelIncident({
      userId: context.userId,
      eventId: data.eventId,
      reason: data.reason || "Canceled by the user",
    });
  });

/**
 * Test alert: always created in test mode, never against live contacts. Without
 * a designated test number it is recorded as simulated and nothing is sent.
 */
export const startTestAlert = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DispatchView> => {
    const settings = await settingsFor(context.userId, context.supabase);
    if (!settings) throw new Error("Save your automatic alert setup first.");
    const startedAt = Date.now();
    const incident = await createOrGetIncident({
      userId: context.userId,
      idempotencyKey: `test:${startedAt}`,
      reasonType: "sos",
      reasonLabel: "Test alert (no emergency)",
      reasonReading: "Started from the automatic alert setup",
      isDemo: true,
      startedAt,
      location: null,
      locationSource: "none",
      settings: { ...settings, test_mode: true, countdown_seconds: 0 },
    });
    await pumpIncident(incident.id);
    return readIncident(incident.id, context.userId);
  });
