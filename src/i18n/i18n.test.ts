import { describe, expect, it } from "vitest";
import { LOCALES, isRtl, localeByCode } from "./locales";
import { en } from "./messages/en";
import { packs } from "./messages/packs";
import { translate } from "./index";

describe("locale catalog", () => {
  it("ships English plus the 22 Scheduled Languages of India", () => {
    expect(LOCALES).toHaveLength(23);
    expect(new Set(LOCALES.map((l) => l.code)).size).toBe(23);
    expect(new Set(LOCALES.map((l) => l.tag)).size).toBe(23);
    expect(LOCALES.map((l) => l.code)).toEqual(
      expect.arrayContaining([
        "as",
        "bn",
        "brx",
        "doi",
        "gu",
        "hi",
        "kn",
        "ks",
        "kok",
        "mai",
        "ml",
        "mni",
        "mr",
        "ne",
        "or",
        "pa",
        "sa",
        "sat",
        "sd",
        "ta",
        "te",
        "ur",
      ]),
    );
  });

  it("marks right-to-left scripts and never claims reviewed safety wording", () => {
    expect(isRtl("ur")).toBe(true);
    expect(isRtl("ks")).toBe(true);
    expect(isRtl("sd")).toBe(true);
    expect(isRtl("hi")).toBe(false);
    expect(LOCALES.every((l) => !l.safetyReviewed)).toBe(true);
    expect(localeByCode("ur").nativeName).toBe("اردو");
  });

  it("only translates keys that exist in the reference pack", () => {
    const keys = new Set(Object.keys(en));
    for (const [code, pack] of Object.entries(packs)) {
      for (const key of Object.keys(pack ?? {})) {
        expect(keys.has(key), `${code} has unknown key ${key}`).toBe(true);
      }
    }
  });

  it("reports partial coverage instead of silently claiming completeness", () => {
    for (const locale of LOCALES.filter((l) => l.code !== "en")) {
      const coverage = Object.keys(packs[locale.code] ?? {}).length / Object.keys(en).length;
      expect(coverage).toBeGreaterThan(0.15);
      expect(coverage).toBeLessThan(1);
      expect(locale.status).toBe("machine-draft");
    }
  });

  it("interpolates values and keeps unreviewed safety text in English", () => {
    expect(translate("en", "translate.tooLong", { max: 5000 })).toContain("5000");
    expect(translate("hi", "safety.callEmergency")).toBe(en["safety.callEmergency"]);
    expect(translate("hi", "chat.send")).toBe("संदेश भेजें");
    expect(translate("ur", "chat.title")).toBe("لائف لائن معاون");
  });
});
