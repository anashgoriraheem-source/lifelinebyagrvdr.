/**
 * Languages the app can *translate text into or out of* without shipping an
 * interface pack for them. This catalog only labels languages; it does not
 * claim the configured provider supports them. The Translate page lists what
 * the provider actually reports and marks everything else as unavailable.
 *
 * Adding a world language here does not add a UI locale: interface packs live
 * in `locales.ts` and are audited by `coverage.ts`.
 */
import { LOCALES } from "./locales";
export interface WorldLanguage {
  code: string;
  tag: string;
  englishName: string;
  nativeName: string;
  dir: "ltr" | "rtl";
}

export const WORLD_LANGUAGES: WorldLanguage[] = [
  { code: "ar", tag: "ar", englishName: "Arabic", nativeName: "العربية", dir: "rtl" },
  // Urdu is widely used in India but has no complete interface pack, so it is
  // offered as a translation target only.
  { code: "ur", tag: "ur", englishName: "Urdu", nativeName: "اردو", dir: "rtl" },
  { code: "fa", tag: "fa", englishName: "Persian", nativeName: "فارسی", dir: "rtl" },
  { code: "he", tag: "he", englishName: "Hebrew", nativeName: "עברית", dir: "rtl" },
  { code: "ps", tag: "ps", englishName: "Pashto", nativeName: "پښتو", dir: "rtl" },
  { code: "dv", tag: "dv", englishName: "Dhivehi", nativeName: "ދިވެހި", dir: "rtl" },
  { code: "ku", tag: "ku", englishName: "Kurdish", nativeName: "Kurdî", dir: "ltr" },
  { code: "fr", tag: "fr", englishName: "French", nativeName: "Français", dir: "ltr" },
  { code: "es", tag: "es", englishName: "Spanish", nativeName: "Español", dir: "ltr" },
  { code: "de", tag: "de", englishName: "German", nativeName: "Deutsch", dir: "ltr" },
  { code: "pt", tag: "pt", englishName: "Portuguese", nativeName: "Português", dir: "ltr" },
  { code: "it", tag: "it", englishName: "Italian", nativeName: "Italiano", dir: "ltr" },
  { code: "nl", tag: "nl", englishName: "Dutch", nativeName: "Nederlands", dir: "ltr" },
  { code: "ru", tag: "ru", englishName: "Russian", nativeName: "Русский", dir: "ltr" },
  { code: "uk", tag: "uk", englishName: "Ukrainian", nativeName: "Українська", dir: "ltr" },
  { code: "pl", tag: "pl", englishName: "Polish", nativeName: "Polski", dir: "ltr" },
  { code: "cs", tag: "cs", englishName: "Czech", nativeName: "Čeština", dir: "ltr" },
  { code: "ro", tag: "ro", englishName: "Romanian", nativeName: "Română", dir: "ltr" },
  { code: "el", tag: "el", englishName: "Greek", nativeName: "Ελληνικά", dir: "ltr" },
  { code: "tr", tag: "tr", englishName: "Turkish", nativeName: "Türkçe", dir: "ltr" },
  { code: "zh", tag: "zh-CN", englishName: "Chinese (Simplified)", nativeName: "简体中文", dir: "ltr" },
  { code: "ja", tag: "ja", englishName: "Japanese", nativeName: "日本語", dir: "ltr" },
  { code: "ko", tag: "ko", englishName: "Korean", nativeName: "한국어", dir: "ltr" },
  { code: "vi", tag: "vi", englishName: "Vietnamese", nativeName: "Tiếng Việt", dir: "ltr" },
  { code: "th", tag: "th", englishName: "Thai", nativeName: "ไทย", dir: "ltr" },
  { code: "id", tag: "id", englishName: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr" },
  { code: "ms", tag: "ms", englishName: "Malay", nativeName: "Bahasa Melayu", dir: "ltr" },
  { code: "tl", tag: "tl", englishName: "Filipino", nativeName: "Filipino", dir: "ltr" },
  { code: "my", tag: "my", englishName: "Burmese", nativeName: "မြန်မာ", dir: "ltr" },
  { code: "km", tag: "km", englishName: "Khmer", nativeName: "ខ្មែរ", dir: "ltr" },
  { code: "lo", tag: "lo", englishName: "Lao", nativeName: "ລາວ", dir: "ltr" },
  { code: "si", tag: "si", englishName: "Sinhala", nativeName: "සිංහල", dir: "ltr" },
  { code: "sw", tag: "sw", englishName: "Swahili", nativeName: "Kiswahili", dir: "ltr" },
  { code: "am", tag: "am", englishName: "Amharic", nativeName: "አማርኛ", dir: "ltr" },
  { code: "ha", tag: "ha", englishName: "Hausa", nativeName: "Hausa", dir: "ltr" },
  { code: "yo", tag: "yo", englishName: "Yoruba", nativeName: "Yorùbá", dir: "ltr" },
  { code: "zu", tag: "zu", englishName: "Zulu", nativeName: "isiZulu", dir: "ltr" },
  { code: "af", tag: "af", englishName: "Afrikaans", nativeName: "Afrikaans", dir: "ltr" },
  { code: "sv", tag: "sv", englishName: "Swedish", nativeName: "Svenska", dir: "ltr" },
  { code: "da", tag: "da", englishName: "Danish", nativeName: "Dansk", dir: "ltr" },
  { code: "fi", tag: "fi", englishName: "Finnish", nativeName: "Suomi", dir: "ltr" },
  { code: "nb", tag: "nb", englishName: "Norwegian", nativeName: "Norsk", dir: "ltr" },
  { code: "hu", tag: "hu", englishName: "Hungarian", nativeName: "Magyar", dir: "ltr" },
  { code: "bg", tag: "bg", englishName: "Bulgarian", nativeName: "Български", dir: "ltr" },
  { code: "sr", tag: "sr", englishName: "Serbian", nativeName: "Српски", dir: "ltr" },
  { code: "hr", tag: "hr", englishName: "Croatian", nativeName: "Hrvatski", dir: "ltr" },
  { code: "sk", tag: "sk", englishName: "Slovak", nativeName: "Slovenčina", dir: "ltr" },
];

export const worldLanguageByCode = (code: string) => {
  const base = code.split("-")[0].toLowerCase();
  return WORLD_LANGUAGES.find((l) => l.code === base) ?? null;
};

export interface LanguageInfo {
  code: string;
  tag: string;
  englishName: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  /** True when the app ships an interface pack for this language. */
  interfaceLocale: boolean;
}

/**
 * Label and direction for any language code the translator may receive —
 * either a shipped interface locale or a translate-only world language.
 */
export function languageInfo(code: string): LanguageInfo {
  const ui = LOCALES.find((l) => l.code === code);
  if (ui) {
    return {
      code: ui.code,
      tag: ui.tag,
      englishName: ui.englishName,
      nativeName: ui.nativeName,
      dir: ui.dir,
      interfaceLocale: true,
    };
  }
  const world = worldLanguageByCode(code);
  if (world) return { ...world, interfaceLocale: false };
  return {
    code,
    tag: code,
    englishName: code.toUpperCase(),
    nativeName: code.toUpperCase(),
    dir: "ltr",
    interfaceLocale: false,
  };
}

export const isTranslatableCode = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value);
