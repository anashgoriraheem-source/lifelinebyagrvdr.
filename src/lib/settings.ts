import { z } from "zod";
import { LOCALE_CODES } from "@/i18n/locales";

const threshold = z.object({
  below: z.number().finite().nullable(),
  above: z.number().finite().nullable(),
  above2: z.number().finite().nullable().optional(),
});

const contact = z.object({
  id: z.string().max(120),
  name: z.string().trim().max(120),
  relationship: z.string().max(100),
  phone: z.string().max(40),
  call: z.boolean(),
  sms: z.boolean(),
  email: z.string().trim().max(200).optional(),
  emailAlerts: z.boolean().optional(),
  confirmedAt: z.number().nullable().optional(),
  testDestination: z.boolean().optional(),
});

export const persistedSettingsSchema = z.object({
  assistantLanguage: z.enum(["en", "hi", "pa", "ur"]).optional(),
  language: z.enum(LOCALE_CODES).optional(),
  /** True once the first-run language step has been confirmed. */
  languageChosen: z.boolean().optional(),
  dispatchConsent: z.boolean().optional(),
  shareLocation: z.boolean().optional(),
  demoMode: z.boolean().optional(),
  contacts: z.array(contact).max(50).optional(),
  countryCode: z.enum(["IN", "US", "GB", "EU", "AU"]).optional(),
  countdownSeconds: z.number().int().min(0).max(60).optional(),
  thresholds: z
    .object({ bp: threshold, hr: threshold, spo2: threshold, glucose: threshold })
    .optional(),
  profile: z
    .object({
      name: z.string().trim().max(120),
      age: z.number().int().min(0).max(130).nullable(),
      bloodType: z.string().max(16),
      conditions: z.array(z.string().max(200)).max(30),
      allergies: z.array(z.string().max(200)).max(30),
      medications: z.array(z.string().max(200)).max(30),
    })
    .optional(),
});

export type PersistedSettings = z.infer<typeof persistedSettingsSchema>;
