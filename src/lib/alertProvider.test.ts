import { describe, expect, it } from "vitest";
import { computeTwilioSignature, signedUrl, verifyTwilioSignature } from "./alertProvider.server";

/**
 * Signature rules keep forged delivery/acknowledgement callbacks out of the
 * incident. Twilio's documented algorithm: HMAC-SHA1 over the full URL followed
 * by every POST parameter sorted by name.
 */
describe("Twilio callback signatures", () => {
  const token = "test-auth-token";
  const url = "https://lifeline.test/api/alerts/twilio/status?i=incident-1";
  const params = { MessageSid: "SM123", MessageStatus: "delivered", To: "+15551234567" };

  it("accepts a signature computed the documented way", () => {
    const signature = computeTwilioSignature(token, url, params);
    expect(verifyTwilioSignature({ authToken: token, url, params, signature })).toBe(true);
  });

  it("rejects a changed status", () => {
    const signature = computeTwilioSignature(token, url, params);
    const tampered = { ...params, MessageStatus: "failed" };
    expect(verifyTwilioSignature({ authToken: token, url, params: tampered, signature })).toBe(false);
  });

  it("rejects a different URL, token or missing signature", () => {
    const signature = computeTwilioSignature(token, url, params);
    expect(
      verifyTwilioSignature({ authToken: "other", url, params, signature }),
    ).toBe(false);
    expect(
      verifyTwilioSignature({ authToken: token, url: url.replace("incident-1", "incident-2"), params, signature }),
    ).toBe(false);
    expect(verifyTwilioSignature({ authToken: token, url, params, signature: null })).toBe(false);
  });

  it("rebuilds the signed URL from the public base even behind a proxy", () => {
    expect(
      signedUrl("https://3000-preview.test/", "http://127.0.0.1:3000/api/alerts/twilio/ack?i=1&a=2"),
    ).toBe("https://3000-preview.test/api/alerts/twilio/ack?i=1&a=2");
  });
});
