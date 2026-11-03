import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_SIGN_IN, nextFromLocation, safeNextPath, withNext } from "./authRedirect";

describe("safeNextPath", () => {
  it("keeps internal paths, with query and hash", () => {
    expect(safeNextPath("/alerts?tab=contacts")).toBe("/alerts?tab=contacts");
    expect(safeNextPath("/schedule#today")).toBe("/schedule#today");
    expect(safeNextPath("/account")).toBe("/account");
  });

  it("rejects anything that could leave the app", () => {
    for (const value of [
      "https://evil.example/steal",
      "//evil.example",
      "/\\evil.example",
      "javascript:alert(1)",
      "\\\\evil.example",
      "account",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(value)).toBe(DEFAULT_AFTER_SIGN_IN);
    }
  });

  it("rejects the callback itself so sign-in cannot loop", () => {
    expect(safeNextPath("/auth/callback?next=/account")).toBe(DEFAULT_AFTER_SIGN_IN);
  });

  it("drops control characters", () => {
    expect(safeNextPath("/alerts\nSet-Cookie: x=1")).toBe(DEFAULT_AFTER_SIGN_IN);
  });
});

describe("withNext", () => {
  it("encodes a validated destination", () => {
    expect(withNext("/auth/callback", "/alerts?tab=1")).toBe(
      "/auth/callback?next=%2Falerts%3Ftab%3D1",
    );
  });

  it("replaces an untrusted destination with the default", () => {
    expect(withNext("/auth/callback", "https://evil.example")).toBe(
      "/auth/callback?next=%2Faccount",
    );
  });
});

describe("nextFromLocation", () => {
  it("reads and validates the parameter", () => {
    expect(nextFromLocation("?next=%2Fmonitor")).toBe("/monitor");
    expect(nextFromLocation("?next=https%3A%2F%2Fevil.example")).toBe(DEFAULT_AFTER_SIGN_IN);
    expect(nextFromLocation("")).toBe(DEFAULT_AFTER_SIGN_IN);
  });
});
