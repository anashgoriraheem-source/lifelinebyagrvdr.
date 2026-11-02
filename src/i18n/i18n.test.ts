import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  LOCALES,
  isLocaleCode,
  isRtl,
  localeByCode,
} from "./locales";
import { en } from "./messages/en";
import { packs } from "./messages/packs";
import { translate } from "./index";
import { worldLanguageByCode } from "./worldLanguages";

const REFERENCE_KEYS = Object.keys(en) as (keyof typeof en)[];

describe("locale catalog", () => {
  it("ships only the interface languages whose packs are complete", () => {
    expect(LOCALES.map((l) => l.code)).toEqual(["en", "hi"]);
    expect(new Set(LOCALES.map((l) => l.tag)).size).toBe(LOCALES.length);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(LOCALE_CODES.every(isLocaleCode)).toBe(true);
    expect(isLocaleCode("ur")).toBe(false);
  });

  it("uses India-specific BCP-47 tags", () => {
    expect(localeByCode("en").tag).toBe("en-IN");
    expect(localeByCode("hi").tag).toBe("hi-IN");
    expect(localeByCode("hi").nativeName).toBe("हिन्दी");
  });

  it("never claims reviewed safety wording, and stays left-to-right", () => {
    expect(LOCALES.every((l) => !l.safetyReviewed)).toBe(true);
    expect(LOCALES.every((l) => l.safetyReviewer === null)).toBe(true);
    expect(isRtl("hi")).toBe(false);
    expect(isRtl("en")).toBe(false);
    // Urdu is a translate-only language: direction comes from the world list,
    // it is never an interface locale by accident.
    expect(worldLanguageByCode("ur")?.dir).toBe("rtl");
  });

  it("has a complete Hindi pack with no unknown or empty keys", () => {
    const keys = new Set(REFERENCE_KEYS);
    for (const [code, pack] of Object.entries(packs)) {
      for (const [key, value] of Object.entries(pack)) {
        expect(keys.has(key as keyof typeof en), `${code} has unknown key ${key}`).toBe(true);
        expect((value ?? "").trim().length, `${code}:${key} is empty`).toBeGreaterThan(0);
      }
    }
    const missing = REFERENCE_KEYS.filter((k) => !(k in packs.hi));
    expect(missing).toEqual([]);
  });

  it("keeps every interpolation placeholder in the Hindi pack", () => {
    for (const key of REFERENCE_KEYS) {
      const placeholders = (text: string) => (text.match(/\{(\w+)\}/g) ?? []).sort();
      expect(placeholders(packs.hi[key] ?? ""), `placeholders in ${key}`).toEqual(
        placeholders(en[key]),
      );
    }
  });

  it("interpolates values and keeps unreviewed safety text in English", () => {
    expect(translate("en", "translate.tooLong", { max: 5000 })).toContain("5000");
    expect(translate("hi", "translate.tooLong", { max: 5000 })).toContain("5000");
    expect(translate("hi", "safety.callEmergency")).toBe(en["safety.callEmergency"]);
    expect(translate("hi", "chat.escalationBody")).toBe(en["chat.escalationBody"]);
    expect(translate("hi", "chat.send")).toBe("संदेश भेजें");
    expect(translate("hi", "onboarding.confirm", { language: "हिन्दी" })).toContain("हिन्दी");
  });
});
