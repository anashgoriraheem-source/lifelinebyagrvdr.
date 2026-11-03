import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { languageInfo, isTranslatableCode } from "@/i18n/worldLanguages";
import type { TranslateResult } from "./translate.server";

import { translationInput as input } from "./translationPolicy";

export interface TranslationReply extends TranslateResult {
  machine: true;
  targetName: string;
  targetDir: "ltr" | "rtl";
  targetTag: string;
}

export const translateText = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<TranslationReply> => {
    const { checkRateLimit, rateKey } = await import("./rateLimit.server");
    const request = getRequest();
    const ip = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const { optionalSupabaseUser } = await import("./serverAuth.server");
    const session = await optionalSupabaseUser();
    const target = languageInfo(data.target);
    const base = {
      machine: true as const,
      targetName: target.englishName,
      targetDir: target.dir,
      targetTag: target.tag,
    };
    if (!checkRateLimit(rateKey("translate", session?.userId ?? null, ip), 30, 60_000)) {
      return {
        ...base,
        status: "error",
        provider: null,
        error: "Too many translations in a short time. Wait a minute and try again.",
      };
    }
    const { translate } = await import("./translate.server");
    const result = await translate(data.text, data.source, data.target, target.englishName);
    return { ...base, ...result };
  });

export const detectTextLanguage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ text: z.string().trim().min(1).max(2000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { detectLanguage } = await import("./translate.server");
    return { detected: await detectLanguage(data.text) };
  });

export const translationStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { translationConfigured } = await import("./translate.server");
  return { configured: translationConfigured() };
});

/**
 * Language catalogue reported by the provider, plus which of those languages
 * also have an interface pack. Only `status: "ok"` means the service named its
 * languages; anything else is reported as unavailable or unverified.
 */
export const translationLanguages = createServerFn({ method: "GET" }).handler(async () => {
  const { checkRateLimit } = await import("./rateLimit.server");
  if (!checkRateLimit("translation-catalog-global", 30, 60_000))
    return {
      status: "error" as const,
      provider: null,
      languages: [],
      note: "Please wait before checking available languages again.",
    };
  const { providerLanguages } = await import("./translate.server");
  const catalog = await providerLanguages();
  return {
    ...catalog,
    languages: catalog.languages.map((l) => {
      const info = languageInfo(l.code);
      return {
        code: l.code,
        name: l.name,
        englishName: info.englishName,
        nativeName: info.nativeName,
        dir: info.dir,
        interfaceLocale: info.interfaceLocale,
      };
    }),
  };
});
