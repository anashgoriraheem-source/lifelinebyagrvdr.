/**
 * Server-side translation adapter.
 *
 * Supported boundaries, in order of preference:
 *  1. A LibreTranslate-compatible service (`TRANSLATE_API_URL`, optional
 *     `TRANSLATE_API_KEY`) — supports detection and returns machine output.
 *  2. The configured chat-model gateway, used only as a translation engine.
 *
 * With neither configured the caller gets `unavailable`, never fabricated text.
 */
export type TranslateStatus = "ok" | "unavailable" | "error";

export interface TranslateResult {
  status: TranslateStatus;
  translatedText?: string;
  detectedLanguage?: string | null;
  /** Language actually used by the provider when the request asked for detection. */
  resolvedSource?: string | null;
  provider: string | null;
  error?: string;
}

interface TranslateConfig {
  url: string;
  key?: string;
}

function translateConfig(): TranslateConfig | null {
  const url = process.env.TRANSLATE_API_URL?.trim();
  if (!url) return null;
  return { url: url.replace(/\/+$/, ""), key: process.env.TRANSLATE_API_KEY?.trim() || undefined };
}

export function translationConfigured() {
  return Boolean(translateConfig() || process.env.AI_API_KEY || process.env.LOVABLE_API_KEY);
}

async function libreTranslate(
  text: string,
  source: string,
  target: string,
  config: TranslateConfig,
): Promise<TranslateResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(`${config.url}/translate`, {
      method: "POST",
      signal: controller.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        q: text,
        source,
        target,
        format: "text",
        ...(config.key ? { api_key: config.key } : {}),
      }),
    });
    if (!response.ok) {
      return {
        status: response.status === 400 || response.status === 422 ? "error" : "error",
        provider: "libretranslate",
        error:
          response.status === 400 || response.status === 422
            ? "The translation service does not support this language pair."
            : `The translation service returned status ${response.status}.`,
      };
    }
    const payload = (await response.json()) as {
      translatedText?: string;
      detectedLanguage?: { language?: string; confidence?: number };
    };
    if (!payload.translatedText)
      return {
        status: "error",
        provider: "libretranslate",
        error: "The translation service returned no text.",
      };
    return {
      status: "ok",
      translatedText: payload.translatedText,
      detectedLanguage: payload.detectedLanguage?.language ?? null,
      resolvedSource: source === "auto" ? (payload.detectedLanguage?.language ?? null) : source,
      provider: "libretranslate",
    };
  } catch (error) {
    return {
      status: "error",
      provider: "libretranslate",
      error:
        error instanceof Error && error.name === "AbortError"
          ? "The translation service timed out."
          : "The translation service could not be reached.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function modelTranslate(
  text: string,
  source: string,
  targetName: string,
): Promise<TranslateResult> {
  const { aiProviderConfig, callChatModel } = await import("./aiProvider.server");
  const config = aiProviderConfig();
  if (!config) return { status: "unavailable", provider: null };
  const result = await callChatModel(
    [
      {
        role: "system",
        content:
          `You are a translation engine. Translate the user's text into ${targetName}. ` +
          `Source language: ${source === "auto" ? "detect it yourself" : source}. ` +
          "Output ONLY the translated text. Do not explain, transliterate, add notes, or add quotation marks. " +
          "Preserve numbers, line breaks and proper nouns. If the target language cannot be written in the available model output, return exactly: UNSUPPORTED",
      },
      { role: "user", content: text },
    ],
    config,
  );
  if (!result.ok || !result.text)
    return {
      status: "error",
      provider: config.name,
      error: result.error ?? "The translation model returned no text.",
    };
  if (/^UNSUPPORTED$/i.test(result.text.trim())) {
    return {
      status: "error",
      provider: config.name,
      error: "The configured model could not produce this language.",
    };
  }
  return {
    status: "ok",
    translatedText: result.text.trim(),
    detectedLanguage: null,
    resolvedSource: source === "auto" ? null : source,
    provider: config.name,
  };
}

export async function translate(
  text: string,
  source: string,
  target: string,
  targetName: string,
): Promise<TranslateResult> {
  const libre = translateConfig();
  if (libre) {
    const result = await libreTranslate(text, source, target, libre);
    // A failed LibreTranslate request is reported as-is; silently switching
    // providers would misrepresent which service produced the text.
    return result;
  }
  return modelTranslate(text, source, targetName);
}

export async function detectLanguage(
  text: string,
): Promise<{ language: string; confidence: number } | null> {
  const libre = translateConfig();
  if (!libre) return null;
  try {
    const response = await fetch(`${libre.url}/detect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ q: text, ...(libre.key ? { api_key: libre.key } : {}) }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { language?: string; confidence?: number }[];
    const best = Array.isArray(payload) ? payload[0] : undefined;
    return best?.language ? { language: best.language, confidence: best.confidence ?? 0 } : null;
  } catch {
    return null;
  }
}

export interface ProviderLanguageCatalog {
  /** `ok` = the provider reported its catalogue; `unverified` = no catalogue. */
  status: "ok" | "unavailable" | "unverified" | "error";
  provider: string | null;
  languages: { code: string; name: string }[];
  note?: string;
}

/**
 * The languages the configured provider actually reports. Nothing is inferred:
 * a model adapter with no catalogue is `unverified`, and no provider at all is
 * `unavailable`, so the UI can never promise a language pair the service does
 * not offer.
 */
export async function providerLanguages(): Promise<ProviderLanguageCatalog> {
  const libre = translateConfig();
  if (libre) {
    try {
      const response = await fetch(`${libre.url}/languages`);
      if (!response.ok)
        return {
          status: "error",
          provider: "libretranslate",
          languages: [],
          note: `The translation service returned status ${response.status} for its language list.`,
        };
      const payload = (await response.json()) as { code?: string; name?: string }[];
      const languages = (Array.isArray(payload) ? payload : [])
        .filter((l): l is { code: string; name: string } => Boolean(l?.code && l?.name))
        .map((l) => ({ code: l.code, name: l.name }));
      return {
        status: "ok",
        provider: "libretranslate",
        languages,
        note: "Reported by the configured translation service.",
      };
    } catch {
      return {
        status: "error",
        provider: "libretranslate",
        languages: [],
        note: "The translation service could not be reached for its language list.",
      };
    }
  }
  if (process.env.AI_API_KEY || process.env.LOVABLE_API_KEY) {
    return {
      status: "unverified",
      provider: "model",
      languages: [],
      note: "The model adapter publishes no verified language catalogue; each request is attempted and reported as machine translated.",
    };
  }
  return {
    status: "unavailable",
    provider: null,
    languages: [],
    note: "No translation provider is configured on this deployment.",
  };
}
