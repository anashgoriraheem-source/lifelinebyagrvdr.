import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { persistedSettingsSchema } from "./settings";
import { z } from "zod";

export const readSafetyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, contacts, preferences] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase.from("contacts").select("*").eq("user_id", context.userId).order("position"),
      context.supabase
        .from("safety_preferences")
        .select("*")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (profile.error || contacts.error || preferences.error)
      throw new Error("Could not load your private safety data. Try again.");
    return {
      profile: profile.data,
      contacts: contacts.data ?? [],
      preferences: preferences.data ?? null,
    };
  });

export const saveSafetyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => persistedSettingsSchema.shape.profile.unwrap().parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("profiles").upsert({
      id: context.userId,
      full_name: data.name,
      age: data.age,
      blood_type: data.bloodType,
      conditions: data.conditions,
      allergies: data.allergies,
      medications: data.medications,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Your profile was not saved. Try again.");
    return { ok: true };
  });

export const saveSafetyContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .array(
        z
          .object({
            name: z.string().trim().min(2).max(120),
            phone: z.string().regex(/^\+?\d{3,15}$/),
            relationship: z.string().max(100),
            call: z.boolean(),
            sms: z.boolean(),
            email: z.string().trim().email().max(200).or(z.literal("")).optional(),
            emailAlerts: z.boolean().optional(),
            confirmedAt: z.number().int().positive().nullable().optional(),
            testDestination: z.boolean().optional(),
          })
          .refine((c) => !c.emailAlerts || Boolean(c.email), {
            message: "An email address is required when email alerts are enabled.",
          }),
      )
      .max(50)
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.rpc("replace_my_contacts", { _contacts: data });
    if (error)
      throw new Error("Contacts were not saved. Your previous saved contacts are unchanged.");
    return { ok: true };
  });

export const saveSafetyPreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        language: z.string().min(2).max(8),
        dispatchConsent: z.boolean(),
        shareLocation: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const existing = await context.supabase
      .from("safety_preferences")
      .select("consent_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    const consentAt = data.dispatchConsent
      ? (existing.data?.consent_at ?? new Date().toISOString())
      : null;
    const { error } = await context.supabase.from("safety_preferences").upsert({
      user_id: context.userId,
      language: data.language,
      dispatch_consent: data.dispatchConsent,
      share_location: data.shareLocation,
      consent_at: consentAt,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error("Your safety preferences were not saved. Try again.");
    return { ok: true, consentAt };
  });

export const exportSafetyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, contacts, incidents, events, attempts, preferences] = await Promise.all([
      context.supabase
        .from("profiles")
        .select("full_name, age, blood_type, conditions, allergies, medications, updated_at")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("contacts")
        .select(
          "name, relationship, phone, email, call, sms, email_alerts, confirmed_at, test_destination, position",
        )
        .eq("user_id", context.userId)
        .order("position"),
      context.supabase
        .from("incidents")
        .select("reason, reading, status, lat, lng, accuracy, location_at, started_at, resolved_at")
        .eq("user_id", context.userId)
        .order("started_at", { ascending: false }),
      context.supabase
        .from("alert_events")
        .select("id, reason_type, reason_label, reason_reading, is_demo, mode, started_at")
        .eq("user_id", context.userId)
        .order("started_at", { ascending: false }),
      context.supabase
        .from("alert_attempts")
        .select(
          "event_id, channel, contact_name, status, provider, detail, attempted_at, retry_count, acknowledged_at",
        )
        .eq("user_id", context.userId),
      context.supabase
        .from("safety_preferences")
        .select("language, dispatch_consent, consent_at, share_location")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    if (
      profile.error ||
      contacts.error ||
      incidents.error ||
      events.error ||
      attempts.error ||
      preferences.error
    )
      throw new Error("Your data could not be exported. Try again.");
    const attemptRows = attempts.data ?? [];
    return {
      profile: profile.data,
      preferences: preferences.data ?? null,
      contacts: contacts.data ?? [],
      incidents: incidents.data ?? [],
      alertEvents: (events.data ?? []).map(({ id, ...event }) => ({
        ...event,
        attempts: attemptRows
          .filter((a) => a.event_id === id)
          .map(
            ({
              channel,
              contact_name,
              status,
              provider,
              detail,
              attempted_at,
              retry_count,
              acknowledged_at,
            }) => ({
              channel,
              contact_name,
              status,
              provider,
              detail,
              attempted_at,
              retry_count,
              acknowledged_at,
            }),
          ),
      })),
    };
  });

export const clearSafetyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("clear_my_safety_data");
    if (error) throw new Error("Your data could not be deleted. Try again.");
    return { ok: true };
  });

export const deleteSafetyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase.rpc("clear_my_safety_data");
    if (error) throw new Error("Safety data deletion failed. Your account has not been deleted.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (result.error)
      throw new Error("Safety data was deleted, but account deletion failed. Try again.");
    return { ok: true };
  });
