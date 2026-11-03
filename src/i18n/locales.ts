/** Catalog metadata is not evidence of clinical or language review. */
export const LOCALE_CODES = ["en", "hi"] as const;
export type LocaleCode = (typeof LOCALE_CODES)[number];
export const DEFAULT_LOCALE: LocaleCode = "en";
export type LocaleStatus = "complete" | "machine-draft" | "partial";
export interface Locale {
  code: LocaleCode;
  tag: string;
  englishName: string;
  nativeName: string;
  dir: "ltr" | "rtl";
  status: LocaleStatus;
  safetyReviewed: boolean;
  safetyReviewer: string | null;
  safetyReviewDate: string | null;
}
export const LOCALES: Locale[] = [
  {
    code: "en",
    tag: "en-IN",
    englishName: "English",
    nativeName: "English",
    dir: "ltr",
    status: "complete",
    safetyReviewed: false,
    safetyReviewer: null,
    safetyReviewDate: null,
  },
  {
    code: "hi",
    tag: "hi-IN",
    englishName: "Hindi",
    nativeName: "हिन्दी",
    dir: "ltr",
    status: "machine-draft",
    safetyReviewed: false,
    safetyReviewer: null,
    safetyReviewDate: null,
  },
];
export const isLocaleCode = (v: unknown): v is LocaleCode => v === "en" || v === "hi";
export const localeByCode = (v: string): Locale => LOCALES.find((l) => l.code === v) ?? LOCALES[0];
export const isRtl = (v: string) => localeByCode(v).dir === "rtl";

export type PackStatus = LocaleStatus;
