import { z } from "zod";
import { LOCALE_CODES } from "@/i18n/locales";

const threshold = z.object({
  below: z.number().finite().nullable(),
  above: z.number().finite().nullable(),
  above2: z.number().finite().nullable().optional(),
});

const contact = z.object({
  id: z.string(),
  name: z.string(),
  relationship: z.string(),
  phone: z.string(),
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
  contacts: z.array(contact).optional(),
  countryCode: z.enum(["IN", "US", "GB", "EU", "AU"]).optional(),
  countdownSeconds: z.number().int().min(0).max(60).optional(),
  thresholds: z
    .object({ bp: threshold, hr: threshold, spo2: threshold, glucose: threshold })
    .optional(),
  profile: z
    .object({
      name: z.string(),
      age: z.number().nonnegative().nullable(),
      bloodType: z.string(),
      conditions: z.array(z.string()),
      allergies: z.array(z.string()),
      medications: z.array(z.string()),
    })
    .optional(),
});

export type PersistedSettings = z.infer<typeof persistedSettingsSchema>;
