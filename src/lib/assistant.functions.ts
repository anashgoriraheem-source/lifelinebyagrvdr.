import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import {
  answerFromLibrary,
  buildModelContext,
  detectEmergency,
  retrieveKnowledge,
  unacceptableModelAnswer,
  type AssistantAnswer,
  type PersonalContext,
} from "./knowledge";
import { localeByCode, isLocaleCode } from "@/i18n/locales";

const reading = z.object({
  key: z.string().max(20),
  label: z.string().min(1).max(40),
  value: z.string().max(24),
  unit: z.string().max(16),
  source: z.string().max(120),
  measuredAt: z.number().int().positive(),
  quality: z.enum(["good", "uncertain", "stale"]),
  stale: z.boolean(),
});

const deviceSnapshot = z.object({
  name: z.string().max(120).optional(),
  age: z.number().int().min(0).max(130).nullable().optional(),
  bloodType: z.string().max(8).optional(),
  conditions: z.array(z.string().max(120)).max(30).optional(),
  allergies: z.array(z.string().max(120)).max(30).optional(),
  medications: z.array(z.string().max(120)).max(30).optional(),
  contacts: z
    .array(
      z.object({
        name: z.string().max(120),
        relationship: z.string().max(80),
        sms: z.boolean(),
        call: z.boolean(),
        email: z.boolean(),
        confirmed: z.boolean(),
      }),
    )
    .max(50)
    .optional(),
  readings: z.array(reading).max(8).optional(),
  incidents: z
    .array(
      z.object({
        reason: z.string().max(200),
        status: z.string().max(40),
        startedAt: z.string().max(40),
      }),
    )
    .max(10)
    .optional(),
});

const askInput = z.object({
  question: z.string().trim().min(1).max(2000),
  locale: z.string().refine(isLocaleCode, "Unsupported locale"),
  /** Per-chat language override; must be a shipped locale. */
  answerLocale: z.string().refine(isLocaleCode, "Unsupported locale").optional(),
  useLibrary: z.boolean().default(true),
  imageName: z.string().max(200).optional(),
  /** Inline data URL, capped at ~2.5 MB. Sent only to the configured model. */
  imageDataUrl: z.string().startsWith("data:image/").max(3_000_000).optional(),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
    .max(8)
    .default([]),
  device: deviceSnapshot.optional(),
});

export interface AssistantReply {
  answer: AssistantAnswer;
  /** Whether a model provider is configured. Never inferred from the answer text. */
  modelConfigured: boolean;
  providerName: string | null;
}

const timeFormatters = new Map<string, Intl.DateTimeFormat>();
function formatter(tag: string) {
  let f = timeFormatters.get(tag);
  if (!f) {
    f = new Intl.DateTimeFormat(tag, { dateStyle: "medium", timeStyle: "short" });
    timeFormatters.set(tag, f);
  }
  return f;
}

async function loadContext(
  userId: string | null,
  snapshot: z.infer<typeof deviceSnapshot> | undefined,
  tag: string,
): Promise<PersonalContext> {
  const formatTime = (t: number) => formatter(tag).format(new Date(t));
  const base: PersonalContext = {
    signedIn: Boolean(userId),
    name: snapshot?.name,
    age: snapshot?.age ?? null,
    bloodType: snapshot?.bloodType,
    conditions: snapshot?.conditions,
    allergies: snapshot?.allergies,
    medications: snapshot?.medications,
    contacts: snapshot?.contacts ?? [],
    readings: (snapshot?.readings ?? []).map((r) => ({ ...r })),
    incidents: (snapshot?.incidents ?? []).map((i) => ({ ...i, startedAt: i.startedAt })),
  };
  if (!userId) return base;
  try {
    const { optionalSupabaseUser } = await import("./serverAuth.server");
    const session = await optionalSupabaseUser();
    if (!session) return base;
    const [profile, contacts, incidents] = await Promise.all([
      session.supabase
        .from("profiles")
        .select("full_name, age, blood_type, conditions, allergies, medications")
        .eq("id", session.userId)
        .maybeSingle(),
      session.supabase
        .from("contacts")
        .select("name, relationship, sms, call, phone, email, email_alerts, confirmed_at")
        .eq("user_id", session.userId)
        .order("position"),
      session.supabase
        .from("alert_events")
        // Alert events are the app's own record of alarms; `mode` is always
        // 'test' in this build, so nothing is described as delivered.
        .select("reason_label, is_demo, mode, started_at")
        .eq("user_id", session.userId)
        .order("started_at", { ascending: false })
        .limit(5),
    ]);
    if (profile.data) {
      base.name = profile.data.full_name || base.name;
      base.age = profile.data.age ?? base.age;
      base.bloodType = profile.data.blood_type || base.bloodType;
      base.conditions = profile.data.conditions;
      base.allergies = profile.data.allergies;
      base.medications = profile.data.medications;
    }
    if (contacts.data?.length) {
      base.contacts = contacts.data.map((c) => ({
        name: c.name,
        relationship: c.relationship,
        sms: c.sms,
        call: c.call,
        email: Boolean(c.email && c.email_alerts),
        confirmed: Boolean(c.confirmed_at),
      }));
    }
    if (incidents.data?.length) {
      base.incidents = incidents.data.map((i) => ({
        reason: i.reason_label,
        status: i.is_demo ? "demo (nothing sent)" : "recorded (test mode, nothing sent)",
        startedAt: formatter(tag).format(new Date(i.started_at)),
      }));
    }
    return base;
  } catch {
    return base;
  }
}

export const askAssistant = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => askInput.parse(data))
  .handler(async ({ data }): Promise<AssistantReply> => {
    const { checkRateLimit, rateKey } = await import("./rateLimit.server");
    const request = getRequest();
    const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const { optionalSupabaseUser } = await import("./serverAuth.server");
    const session = await optionalSupabaseUser();
    if (!checkRateLimit(rateKey("assistant", session?.userId ?? null, ip), 20, 60_000)) {
      return {
        modelConfigured: false,
        providerName: null,
        answer: {
          status: "unavailable",
          provider: "library",
          escalate: false,
          text: "Too many questions in a short time. Wait a minute and try again. If this is an emergency, call your local emergency number now.",
          sources: [],
          groundedIn: [],
          languageFallback: false,
        },
      };
    }

    const locale = localeByCode(data.answerLocale ?? data.locale);
    const tag = locale.tag;
    const context = await loadContext(session?.userId ?? null, data.device, tag);
    const formatTime = (t: number) => formatter(tag).format(new Date(t));
    const emergency = detectEmergency(data.question);
    const retrieved = retrieveKnowledge(data.question);

    const { aiProviderConfig, callChatModel } = await import("./aiProvider.server");
    const config = aiProviderConfig();
    const library = answerFromLibrary(data.question, context, {
      formatTime,
      language: locale.code,
      languageName: locale.englishName,
    });

    if (!config) {
      return {
        answer: {
          ...library,
          limitation: [
            library.limitation,
            "No language model is configured on this deployment. This answer comes from AAPDA SETU’s curated first-aid library and your own records, not from generative AI.",
          ]
            .filter(Boolean)
            .join(" "),
        },
        modelConfigured: false,
        providerName: null,
      };
    }

    const modelContext = buildModelContext(
      [
        data.history
          .filter((h) => h.role === "user")
          .slice(-3)
          .map((h) => h.text)
          .join("\n"),
        data.question,
      ]
        .filter(Boolean)
        .join("\n"),
      context,
      retrieved,
      { today: formatter("en-CA").format(new Date()), languageName: locale.englishName },
    );
    const result = await callChatModel(
      [
        { role: "system", content: modelContext },
        {
          role: "user",
          content: data.imageDataUrl
            ? [
                { type: "text" as const, text: data.question },
                { type: "image_url" as const, image_url: { url: data.imageDataUrl } },
              ]
            : data.question,
        },
      ],
      config,
    );

    if (!result.ok || !result.text || unacceptableModelAnswer(result.text)) {
      return {
        answer: {
          ...library,
          limitation: [
            library.limitation,
            result.error ??
              "The model answer was rejected because it contained unsupported placeholders.",
            "Showing AAPDA SETU’s curated library answer instead.",
          ]
            .filter(Boolean)
            .join(" "),
        },
        modelConfigured: true,
        providerName: config.name,
      };
    }

    const escalationLine = emergency.emergent
      ? `CALL YOUR LOCAL EMERGENCY NUMBER NOW. This sounds like ${emergency.label ?? "a time-critical emergency"}. Do not wait for this assistant.\n\n`
      : "";
    const groundedIn = new Set<AssistantAnswer["groundedIn"][number]>();
    if (context.signedIn) {
      if (context.name) groundedIn.add("profile");
      if (context.contacts.length) groundedIn.add("contacts");
      if (context.readings.length) groundedIn.add("readings");
      if (context.incidents.length) groundedIn.add("incidents");
    }
    return {
      answer: {
        status: "answered",
        provider: "model",
        escalate: Boolean(emergency.emergent),
        text: escalationLine + result.text.trim(),
        sources: retrieved.sources.length ? retrieved.sources : library.sources,
        groundedIn: [...groundedIn],
        languageFallback: false,
        limitation:
          locale.code !== "en"
            ? "Machine-generated text in the selected language. Not reviewed by a clinician or a human translator."
            : "Machine-generated text. Not reviewed by a clinician.",
        guideId: library.guideId,
      },
      modelConfigured: true,
      providerName: config.name,
    };
  });

export const medicalSources = createServerFn({ method: "GET" }).handler(async () => {
  const { knowledgeBaseSummary } = await import("@/data/health-sources");
  return knowledgeBaseSummary();
});

export const assistantStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { aiProviderConfig } = await import("./aiProvider.server");
  const config = aiProviderConfig();
  return { modelConfigured: Boolean(config), providerName: config?.name ?? null };
});
