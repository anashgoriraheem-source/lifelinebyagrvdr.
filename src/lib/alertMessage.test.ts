import { describe, expect, it } from "vitest";
import {
  ALERT_LOCATION_STALE_MS,
  alertCallScript,
  alertSmsBody,
  alertTwiml,
  classifyProviderStatus,
  describeLocation,
  type AlertMessageInput,
} from "./alertMessage";

const at = Date.parse("2026-11-03T09:15:00Z");
const location = { lat: 12.971599, lng: 77.594566, accuracy: 35, at };
const base: AlertMessageInput = {
  identity: "Asha Sharma",
  triggerLabel: "SOS button",
  startedAt: at,
  location,
  includeLocation: true,
  testMode: false,
  now: at + 5_000,
};

describe("alert message content", () => {
  it("identifies the person, the trigger and the time", () => {
    const body = alertSmsBody(base);
    expect(body).toContain("Asha Sharma");
    expect(body).toContain("sos button");
    expect(body).toContain("Lifeline emergency alert");
  });

  it("adds a location link with the reported accuracy", () => {
    expect(alertSmsBody(base)).toContain("maps.google.com/?q=12.971599,77.594566");
    expect(alertSmsBody(base)).toContain("accuracy about 35 m");
  });

  it("labels an old fix as out of date instead of current", () => {
    const text = describeLocation(location, true, at + ALERT_LOCATION_STALE_MS + 1);
    expect(text).toContain("OUT OF DATE");
  });

  it("says location was unavailable rather than guessing", () => {
    expect(describeLocation(null, true, at)).toBe("Location unavailable.");
    expect(alertSmsBody({ ...base, location: null })).toContain("Location unavailable.");
  });

  it("respects a decision not to share location", () => {
    const body = alertSmsBody({ ...base, includeLocation: false });
    expect(body).not.toContain("maps.google.com");
    expect(body).toContain("Location was not included.");
  });

  it("marks a test alert so a contact cannot mistake it for a real one", () => {
    expect(alertSmsBody({ ...base, testMode: true })).toContain("[Lifeline TEST");
  });

  it("never includes medical history", () => {
    const body = alertSmsBody(base);
    for (const word of ["blood", "condition", "allerg", "medicat", "mg"]) {
      expect(body.toLowerCase()).not.toContain(word);
    }
  });

  it("speaks the call script and asks for a keypad acknowledgement", () => {
    const script = alertCallScript(base);
    expect(script).toContain("automated emergency alert");
    expect(script).toContain("Press 1");
    expect(script).toContain("Asha Sharma");
  });

  it("escapes spoken text inside the TwiML document", () => {
    const xml = alertTwiml('Use <b> & "loud"', "https://example.test/ack?i=1&a=2");
    expect(xml).toContain("&lt;b&gt;");
    expect(xml).toContain("&amp;");
    expect(xml).toContain('<Gather numDigits="1"');
    expect(xml).toContain("https://example.test/ack?i=1&amp;a=2");
  });
});

describe("provider status mapping", () => {
  it("does not call an accepted message delivered", () => {
    expect(classifyProviderStatus("sms", "queued").status).toBe("provider-accepted");
    expect(classifyProviderStatus("sms", "sent").status).toBe("provider-accepted");
    expect(classifyProviderStatus("sms", "delivered").status).toBe("delivered");
  });

  it("reports failures with the provider's reason", () => {
    const result = classifyProviderStatus("sms", "undelivered");
    expect(result.status).toBe("failed");
    expect(result.error).toContain("undelivered");
  });

  it("keeps an answered call distinct from an acknowledgement", () => {
    const answered = classifyProviderStatus("call", "in-progress");
    expect(answered.status).toBe("answered");
    expect(answered.answered).toBe(true);
    expect(answered.acknowledged).toBe(false);
  });

  it("treats a hung-up completed call as unanswered", () => {
    const result = classifyProviderStatus("call", "completed", { durationSeconds: 0 });
    expect(result.status).toBe("failed");
    expect(result.answered).toBe(false);
  });

  it("maps ringing and no-answer correctly", () => {
    expect(classifyProviderStatus("call", "ringing").status).toBe("ringing");
    expect(classifyProviderStatus("call", "no-answer").status).toBe("failed");
  });
});
