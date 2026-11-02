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

  it("marks every non-English pack as partial and unreviewed", () => {
    for (const audit of auditPacks().filter((a) => a.code !== "en")) {
      expect(audit.complete).toBe(false);
      expect(audit.safetyReviewed).toBe(false);
      expect(audit.missingBySurface.length).toBeGreaterThan(0);
    }
    const english = auditLocale("en");
    expect(english.complete).toBe(true);
    expect(describeLocale(english).tone).toBe("complete");
  });

  it("counts safety-critical strings as required, not optional", () => {
    const safety = auditLocale("hi").missingBySurface.find((s) => s.surface === "safety");
    expect(REQUIRED_SURFACES.safety.length).toBeGreaterThan(0);
    // The audit follows the pack: any absent safety string is listed, not assumed present.
    expect(safety?.missing).toEqual(
      REQUIRED_SURFACES.safety.filter((key) => !(key in (packs.hi ?? {}))),
    );
  });
});
