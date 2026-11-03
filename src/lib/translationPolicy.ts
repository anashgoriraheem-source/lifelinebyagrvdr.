import { z } from "zod";
export const publicTranslationPhrases = [
  "Keep the device close and switched on.",
  "You can continue without a device.",
  "कृपया डिवाइस पास और चालू रखें।",
  "आप डिवाइस के बिना आगे बढ़ सकते हैं।",
] as const;
export const translationInput = z
  .object({
    text: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(
        (v) => publicTranslationPhrases.includes(v as (typeof publicTranslationPhrases)[number]),
        "Only public setup phrases are permitted",
      ),
    source: z.enum(["auto", "en", "hi"]),
    target: z.enum(["en", "hi"]),
    consent: z.literal(true),
  })
  .strict();
