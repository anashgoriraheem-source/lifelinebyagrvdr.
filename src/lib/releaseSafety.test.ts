import { describe, it, expect, afterEach, vi } from "vitest";
import { translationInput, publicTranslationPhrases } from "./translationPolicy";
import { rateKey, checkRateLimit } from "./rateLimit.server";
import { buildSosMessage } from "./sos";
import { appStore, set, loadSettings, deleteDeviceLocalData, emergencyNumbers } from "./store";
import { detectEmergency } from "./knowledge";
import { classify } from "./detection";
const original = appStore.state;
afterEach(() => {
  appStore.setState(() => original);
  localStorage.clear();
  vi.restoreAllMocks();
});
describe("Release safety and privacy boundaries", () => {
  it("requires affirmative consent, supported languages, bounded allowlisted public text", () => {
    const ok = { text: publicTranslationPhrases[0], source: "en", target: "hi", consent: true };
    expect(translationInput.safeParse(ok).success).toBe(true);
    for (const patch of [
      { consent: false },
      { consent: undefined },
      { source: "xx" },
      { target: "ur" },
      { text: "x".repeat(501) },
      { text: "my blood pressure is 220" },
      { preciseLocation: "private" },
    ])
      expect(translationInput.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
  it("does not let spoofed forwarded addresses bypass anonymous rate limits", () => {
    const a = rateKey("unit-fixture", null, "1.2.3.4"),
      b = rateKey("unit-fixture", null, "9.8.7.6");
    expect(a).toBe(b);
    expect(checkRateLimit(a, 2, 1000, 100)).toBe(true);
    expect(checkRateLimit(b, 2, 1000, 101)).toBe(true);
    expect(checkRateLimit(a, 2, 1000, 102)).toBe(false);
    expect(checkRateLimit(a, 2, 1000, 1101)).toBe(true);
  });
  it("does not leak profile, health readings or location in default/test drafts", () => {
    set({
      language: "en",
      profile: {
        name: "SYNTHETIC PRIVATE NAME",
        age: 42,
        bloodType: "AB+",
        conditions: ["SYNTHETIC CONDITION"],
        allergies: [],
        medications: [],
      },
    });
    const fix = { lat: 12.345678, lng: 77.123456, accuracy: 10, at: Date.now() };
    const reason = { type: "sos" as const, label: "PRIVATE HEALTH", reading: "PRIVATE READING" };
    for (const opts of [{}, { test: true }]) {
      const draft = buildSosMessage(reason, fix, opts);
      expect(draft).not.toContain("SYNTHETIC PRIVATE");
      expect(draft).not.toContain("PRIVATE HEALTH");
      expect(draft).not.toContain("maps.google");
      expect(draft).not.toContain("Sent via");
    }
    expect(buildSosMessage(reason, fix, { includeMedical: true, includeLocation: true })).toContain(
      "SYNTHETIC PRIVATE NAME",
    );
  });
  it("labels opted-in stale locations rather than claiming current position", () => {
    const fix = { lat: 1, lng: 2, accuracy: 30, at: Date.now() - 300000 };
    expect(buildSosMessage(null, fix, { includeLocation: true })).toContain("OUT OF DATE");
  });
  it("never falls back to another country number for an unknown jurisdiction", () => {
    set({ countryCode: "UNKNOWN" });
    expect(emergencyNumbers(appStore.state).general).toBe("");
  });
  it("keeps malformed persisted settings intact rather than overwriting them", () => {
    localStorage.setItem("lifeline:settings:v1", JSON.stringify({ contacts: "not an array" }));
    const unsubscribe = loadSettings();
    set({ language: "hi" });
    expect(appStore.state.storageIssue).toBe("invalid");
    expect(localStorage.getItem("lifeline:settings:v1")).toContain("not an array");
    unsubscribe();
  });
  it("reports unavailable local storage instead of claiming saved settings", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("test quota failure");
    });
    const unsubscribe = loadSettings();
    set({ countryCode: "US" });
    expect(appStore.state.storageIssue).toBe("blocked");
    unsubscribe();
  });
  it("deletes only owned local keys and clears private session information", () => {
    localStorage.setItem("unrelated-app-key", "KEEP");
    localStorage.setItem("lifeline:settings:v1", "{}");
    localStorage.setItem("lifeline:reading-days:v1", "{}");
    set({
      contacts: [
        {
          id: "synthetic",
          name: "SYNTHETIC",
          phone: "0000000000",
          relationship: "test",
          sms: false,
          call: false,
        },
      ],
    });
    expect(deleteDeviceLocalData()).toBe(true);
    expect(appStore.state.contacts).toEqual([]);
    expect(localStorage.getItem("unrelated-app-key")).toBe("KEEP");
    expect(localStorage.getItem("lifeline:settings:v1")).toBeNull();
  });
  it("keeps uncertain device packets out of automatic medical alarms", () => {
    expect(
      classify(
        "hr",
        {
          value: 250,
          unit: "bpm",
          source: "synthetic",
          measuredAt: Date.now(),
          receivedAt: Date.now(),
          quality: "uncertain",
        },
        { below: 40, above: 140 },
      ),
    ).toBe("unknown");
  });
  it.each([
    "crushing chest pain",
    "not breathing",
    "severe bleeding",
    "सीने में दर्द",
    "मैं बेहोश हो रहा हूँ",
  ])("escalates a known urgent phrase without provider dependency: %s", (text) => {
    expect(detectEmergency(text).emergent).toBe(true);
  });
});
