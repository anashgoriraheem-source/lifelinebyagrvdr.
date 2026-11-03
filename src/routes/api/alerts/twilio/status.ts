import { createFileRoute } from "@tanstack/react-router";
import { alertProviderConfig, signedUrl, verifyTwilioSignature } from "@/lib/alertProvider.server";
import { applyProviderStatus } from "@/lib/alertDispatch.server";

/**
 * Twilio delivery and call-status callback.
 *
 * The request is accepted only with a valid X-Twilio-Signature computed over the
 * public URL and the form body, so a third party cannot forge a "delivered" or
 * "answered" state. Processing is idempotent: a repeated callback rewrites the
 * same states and appends one timeline row per distinct update.
 */
export const Route = createFileRoute("/api/alerts/twilio/status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = alertProviderConfig();
        if (!cfg.authToken) return new Response("Not configured", { status: 503 });

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
        const sid = params.CallSid ?? params.MessageSid ?? "";
        const status = params.MessageStatus ?? params.CallStatus ?? "";
        const answeredBy = params.AnsweredBy;
        const durationSeconds = params.CallDuration ? Number(params.CallDuration) : undefined;
        if (!eventId || !sid || !status) return new Response("Ignored", { status: 200 });

        await applyProviderStatus({
          eventId,
          sid,
          providerStatus: status,
          answeredBy,
          durationSeconds,
        });
        // Twilio only needs 2xx; no body.
        return new Response("", { status: 204 });
      },
    },
  },
});
