import { createFileRoute } from "@tanstack/react-router";
import { alertProviderConfig, signedUrl, verifyTwilioSignature } from "@/lib/alertProvider.server";
import { acknowledgeAlert } from "@/lib/alertDispatch.server";
import { ackTwiml } from "@/lib/alertMessage";

/**
 * Keypad action from the automated call. "1" records an acknowledgement (a real
 * confirmation from a person, unlike an answered call); "2" asks Lifeline to
 * stop calling this contact. The signature is verified before anything changes.
 */
export const Route = createFileRoute("/api/alerts/twilio/ack")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = alertProviderConfig();
        const xml = new Response(ackTwiml(false, false), {
          headers: { "content-type": "text/xml; charset=utf-8" },
        });
        if (!cfg.authToken) return xml;

        const form = await request.formData();
        const params: Record<string, string> = {};
        form.forEach((value, key) => {
          if (typeof value === "string") params[key] = value;
        });
        const valid = verifyTwilioSignature({
          authToken: cfg.authToken,
          url: signedUrl(cfg.publicBaseUrl, request.url),
          params,
          signature: request.headers.get("x-twilio-signature"),
        });
        if (!valid) return new Response("Invalid signature", { status: 403 });

        const url = new URL(request.url);
        const eventId = url.searchParams.get("i") ?? "";
        const attemptId = url.searchParams.get("a") ?? "";
        const digits = params.Digits ?? "";
        if (!eventId || !attemptId) return xml;

        const result = await acknowledgeAlert({
          eventId,
          attemptId,
          stopCalls: digits === "2",
        });
        return new Response(result.message, {
          headers: { "content-type": "text/xml; charset=utf-8" },
        });
      },
    },
  },
});
