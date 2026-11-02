import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/hooks/useApp";
import { set } from "@/lib/store";
import { LOCALES, isLocaleCode, isRtl, localeByCode, type LocaleCode } from "./locales";
import { en, type MessageKey } from "./messages/en";
import { packs } from "./messages/packs";

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

export interface I18nValue {
  locale: LocaleCode;
  dir: "ltr" | "rtl";
  tag: string;
  t: Translate;
  setLanguage: (code: LocaleCode) => void;
  /** Fraction of the reference catalog translated in this pack (0–1). */
  coverage: number;
  /** True when this pack has an entry for the key. */
  has: (key: MessageKey) => boolean;
  /** True when the pack's safety-critical wording has been reviewed. */
  safetyReviewed: boolean;
  formatDateTime: (value: number | string | Date) => string;
  formatTime: (value: number | string | Date) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  /** Native names for selectors. */
  locales: typeof LOCALES;
}

/**
 * Safety-critical strings must not be shown from an unreviewed pack as though
 * they were authoritative. They stay in English until a qualified reviewer
 * signs off the locale; the UI surfaces the limitation next to them.
 */
export const SAFETY_CRITICAL_KEYS: MessageKey[] = [
  "safety.callEmergency",
  "safety.notMedicalDevice",
  "chat.escalationTitle",
  "chat.escalationBody",
];

const TOTAL_KEYS = Object.keys(en).length;

function interpolate(text: string, vars?: Record<string, string | number>) {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? `{${name}}` : String(vars[name]),
  );
}

export function translate(
  locale: LocaleCode,
  key: MessageKey,
  vars?: Record<string, string | number>,
) {
  const definition = localeByCode(locale);
  const pack = packs[locale];
  const critical = SAFETY_CRITICAL_KEYS.includes(key);
  // Never present unreviewed safety wording in a non-English locale.
  if (critical && !definition.safetyReviewed) return interpolate(en[key], vars);
  return interpolate(pack?.[key] ?? en[key], vars);
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useApp((s) => s.language);
  const definition = localeByCode(locale);
  const [announcement, setAnnouncement] = useState("");
  const announced = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = definition.tag;
    root.dir = definition.dir;
    return () => {
      root.dir = "ltr";
    };
  }, [definition.tag, definition.dir]);

  // Screen-reader announcement for a language change (never on first render).
  useEffect(() => {
    if (!announced.current) {
      announced.current = true;
      return;
    }
    setAnnouncement(
      translate(locale, "a11y.languageChanged", { language: definition.nativeName }),
    );
  }, [locale, definition.nativeName]);

  const value = useMemo<I18nValue>(() => {
    const pack = packs[locale];
    const coverage = locale === "en" ? 1 : Object.keys(pack ?? {}).length / TOTAL_KEYS;
    return {
      locale,
      dir: definition.dir,
      tag: definition.tag,
      t: (key, vars) => translate(locale, key, vars),
      setLanguage: (code) => {
        if (isLocaleCode(code)) set({ language: code });
      },
      coverage,
      has: (key) => locale === "en" || Boolean(pack?.[key]),
      safetyReviewed: definition.safetyReviewed,
      formatDateTime: (v) =>
        new Intl.DateTimeFormat(definition.tag, { dateStyle: "medium", timeStyle: "short" }).format(
          new Date(v),
        ),
      formatTime: (v) =>
        new Intl.DateTimeFormat(definition.tag, { hour: "numeric", minute: "2-digit" }).format(
          new Date(v),
        ),
      formatNumber: (v, options) => new Intl.NumberFormat(definition.tag, options).format(v),
      locales: LOCALES,
    };
  }, [locale, definition]);

  return (
    <I18nContext.Provider value={value}>
      {children}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export { LOCALES, isRtl, localeByCode };
export type { LocaleCode, MessageKey };
