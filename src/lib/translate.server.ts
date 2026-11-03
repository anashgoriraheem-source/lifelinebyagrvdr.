/** Real LibreTranslate transport. No model fallback, no mock output, no PHI.
 * Only the public setup phrases below may leave this server. Arbitrary health,
 * location and contact text is blocked until a separately approved design.
 */
export type TranslateStatus = "ok" | "unavailable" | "error";
export interface TranslateResult {
  status: TranslateStatus;
  translatedText?: string;
  detectedLanguage?: string | null;
  resolvedSource?: string | null;
  provider: string | null;
  error?: string;
}
import { publicTranslationPhrases as PUBLIC_TRANSLATION_PHRASES } from "./translationPolicy";

function config() {
  const raw = process.env.TRANSLATE_API_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    // Operator-controlled only. Never accept provider URLs in request input.
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash)
      return null;
    return { url: url.href.replace(/\/+$/, ""), key: process.env.TRANSLATE_API_KEY?.trim() };
  } catch {
    return null;
  }
}
export const translationConfigured = () => Boolean(config());
const failure = (error: string): TranslateResult => ({
  status: "error",
  provider: "libretranslate",
  error,
});
async function request(path: string, body?: unknown) {
  const c = config();
  if (!c) throw new Error("unconfigured");
  const response = await fetch(`${c.url}/${path}`, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(8000),
    redirect: "error",
    headers: { "content-type": "application/json" },
    ...(body ? { body: JSON.stringify({ ...body, ...(c.key ? { api_key: c.key } : {}) }) } : {}),
  });
  if (!response.ok) throw new Error("provider-unavailable");
  // Reject unbounded provider payloads, including chunked responses.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("invalid-response");
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 64000) {
        await reader.cancel();
        throw new Error("response-too-large");
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(text + decoder.decode()) as unknown;
}
export interface ProviderLanguageCatalog {
  status: "ok" | "unavailable" | "unverified" | "error";
  provider: string | null;
  languages: { code: string; name: string; targets?: string[] }[];
  note?: string;
}
let cached: { expires: number; value: ProviderLanguageCatalog } | null = null;
export async function providerLanguages(): Promise<ProviderLanguageCatalog> {
  if (!config())
    return {
      status: "unavailable",
      provider: null,
      languages: [],
      note: "Translation is blocked until the operator configures a provider. Bundled interface languages still work.",
    };
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const payload = await request("languages");
    if (!Array.isArray(payload)) throw new Error("invalid-catalog");
    const languages = payload
      .filter(
        (v): v is { code: string; name: string } =>
          typeof v?.code === "string" &&
          typeof v?.name === "string" &&
          ["en", "hi"].includes(v.code),
      )
      .map((v) => ({
        code: v.code,
        name: v.name,
        targets: Array.isArray((v as { targets?: unknown }).targets)
          ? (v as { code: string; name: string; targets: string[] }).targets.filter((t) =>
              ["en", "hi"].includes(t),
            )
          : [],
      }));
    const value: ProviderLanguageCatalog = {
      status: "ok",
      provider: "libretranslate",
      languages,
      note: "Provider-reported languages. Only public setup phrases are allowed.",
    };
    cached = { expires: Date.now() + 60000, value };
    return value;
  } catch {
    return {
      status: "error",
      provider: "libretranslate",
      languages: [],
      note: "The translation service could not be reached. Use the bundled English or Hindi interface.",
    };
  }
}
export async function translate(
  text: string,
  source: string,
  target: string,
  _targetName?: string,
): Promise<TranslateResult> {
  if (!PUBLIC_TRANSLATION_PHRASES.includes(text as (typeof PUBLIC_TRANSLATION_PHRASES)[number]))
    return failure(
      "Only the listed public setup phrases can be translated. Do not enter health, location or contact information.",
    );
  if (!["auto", "en", "hi"].includes(source) || !["en", "hi"].includes(target))
    return failure("Only English and Hindi are enabled.");
  if (!config())
    return {
      status: "unavailable",
      provider: null,
      error:
        "Translation is not configured. Use the bundled English or Hindi interface, available without this API.",
    };
  const resolvedSource = source === "auto" ? (/[\u0900-\u097f]/.test(text) ? "hi" : "en") : source;
  const catalog = await providerLanguages();
  if (
    catalog.status !== "ok" ||
    !catalog.languages.some((l) => l.code === target) ||
    !catalog.languages.some(
      (l) =>
        l.code === resolvedSource && (resolvedSource === target || l.targets?.includes(target)),
    )
  )
    return failure(
      "The provider has not confirmed this language pair. Use the bundled interface instead.",
    );
  try {
    const result = (await request("translate", {
      q: text,
      source: resolvedSource,
      target,
      format: "text",
    })) as { translatedText?: unknown; detectedLanguage?: { language?: string } };
    if (
      typeof result.translatedText !== "string" ||
      !result.translatedText.trim() ||
      result.translatedText.length > 10000
    )
      return failure("The service returned no usable translation.");
    return {
      status: "ok",
      provider: "libretranslate",
      translatedText: result.translatedText,
      detectedLanguage: result.detectedLanguage?.language ?? null,
      resolvedSource,
    };
  } catch {
    return failure(
      "The translation service did not respond in time or could not be reached. Use the bundled interface instead.",
    );
  }
}
export async function detectLanguage(_text: string): Promise<null> {
  return null;
} // No separate transmission without consent.
