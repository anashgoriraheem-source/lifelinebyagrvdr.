import { describe, expect, it } from "vitest";
import { classifyAuthFailure, oauthFailureFromParams } from "./authErrors";

describe("classifyAuthFailure", () => {
  it("maps the provider messages a person actually hits", () => {
    expect(classifyAuthFailure({ message: "Invalid login credentials" }).kind).toBe(
      "invalid-credentials",
    );
    expect(classifyAuthFailure({ message: "Email not confirmed" }).kind).toBe(
      "email-unconfirmed",
    );
    expect(classifyAuthFailure({ message: "User already registered" }).kind).toBe(
      "already-registered",
    );
    expect(
      classifyAuthFailure({ message: "Password should be at least 6 characters" }).kind,
    ).toBe("weak-password");
    expect(
      classifyAuthFailure({
        message: "For security purposes, you can only request this after 41 seconds.",
      }).kind,
    ).toBe("rate-limited");
    expect(
      classifyAuthFailure({ message: "New password should be different from the old one" }).kind,
    ).toBe("same-password");
    expect(classifyAuthFailure({ message: "Signups not allowed for this instance" }).kind).toBe(
      "signup-disabled",
    );
    expect(classifyAuthFailure({ message: "Provider is not enabled" }).kind).toBe(
      "provider-unavailable",
    );
    expect(classifyAuthFailure({ message: "Email link is invalid or has expired" }).kind).toBe(
      "link-expired",
    );
  });

  it("treats a failed request as a network problem, not a credential problem", () => {
    const offline = classifyAuthFailure({ message: "TypeError: Failed to fetch" });
    expect(offline.kind).toBe("offline");
    expect(offline.action).toBe("retry");
    expect(classifyAuthFailure(new TypeError("Load failed")).kind).toBe("offline");
  });

  it("keeps the provider wording and never invents a cause", () => {
    const failure = classifyAuthFailure({ message: "Something unusual happened" });
    expect(failure.kind).toBe("unknown");
    expect(failure.providerMessage).toBe("Something unusual happened");
  });
});

describe("oauthFailureFromParams", () => {
  it("reads a cancelled consent screen", () => {
    const failure = oauthFailureFromParams(
      new URLSearchParams("error=access_denied&error_description=User+denied+access"),
    );
    expect(failure?.kind).toBe("cancelled");
  });

  it("returns null when the callback carries no error", () => {
    expect(oauthFailureFromParams(new URLSearchParams("code=abc"))).toBeNull();
  });
});
