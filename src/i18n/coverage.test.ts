import { describe, expect, it } from "vitest";
import {
  ALL_REQUIRED_KEYS,
  REQUIRED_SURFACES,
  auditLocale,
  auditPacks,
  describeLocale,
  referenceKeyCount,
} from "./coverage";
import { packs } from "./messages/packs";
import { en } from "./messages/en";

describe("locale pack validation", () => {
  it("has every required surface key in the English reference pack", () => {
    for (const key of ALL_REQUIRED_KEYS) {
      expect(en[key], `missing English string ${key}`).toBeTypeOf("string");
      expect(en[key].length).toBeGreaterThan(0);
    }
  });

  it("covers every required surface in Hindi too", () => {
    for (const [surface, keys] of Object.entries(REQUIRED_SURFACES)) {
      const missing = keys.filter((k) => !(k in packs.hi));
      expect(missing, `${surface} is missing from the Hindi pack`).toEqual([]);
    }
  });

  it("reports missing keys instead of claiming a complete translation", () => {
    for (const audit of auditPacks()) {
      expect(audit.coverage).toBeGreaterThanOrEqual(0);
      expect(audit.coverage).toBeLessThanOrEqual(1);
      expect(audit.missingKeys.length + (referenceKeyCount - audit.missingKeys.length)).toBe(
        referenceKeyCount,
      );
      if (!audit.complete) {
        const described = describeLocale(audit);
        expect(described.tone).toBe("partial");
        expect(described.message).toMatch(/missing/i);
      }
    }
  });

  it("marks a complete pack as machine-drafted while its safety wording is unreviewed", () => {
    const hindi = auditLocale("hi");
    expect(hindi.complete).toBe(true);
    expect(hindi.status).toBe("machine-draft");
    expect(hindi.safetyReviewed).toBe(false);
    expect(describeLocale(hindi).tone).toBe("machine");
    expect(describeLocale(hindi).message).toMatch(/not reviewed/i);

    const english = auditLocale("en");
    expect(english.complete).toBe(true);
    expect(describeLocale(english).tone).toBe("complete");
  });

  it("counts safety-critical strings as required, not optional", () => {
    const safety = auditLocale("hi").missingBySurface.find((s) => s.surface === "safety");
    expect(REQUIRED_SURFACES.safety.length).toBeGreaterThan(0);
    // Nothing missing means no safety surface is listed at all.
    expect(safety).toBeUndefined();
    expect(REQUIRED_SURFACES.safety.filter((key) => !(key in packs.hi))).toEqual([]);
  });
});
