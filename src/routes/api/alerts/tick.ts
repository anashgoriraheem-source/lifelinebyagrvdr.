import { createFileRoute } from "@tanstack/react-router";
import { alertProviderConfig } from "@/lib/alertProvider.server";
import { dueIncidentIds, pumpIncident } from "@/lib/alertDispatch.server";

/**
 * Scheduler entry point. A platform cron (or any trusted scheduler) calls this
 * with the ALERT_TICK_SECRET header so countdowns expire and calls escalate even
 * when no browser has the app open. Without ALERT_TICK_SECRET the route refuses
 * rather than exposing a way to trigger dispatch.
 */
export const Route = createFileRoute("/api/alerts/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = alertProviderConfig();
        if (!cfg.tickSecret) {
          return Response.json({ ok: false, error: "tick-not-configured" }, { status: 503 });
        }
        const provided = request.headers.get("x-alert-tick-secret") ?? "";
        if (provided.length !== cfg.tickSecret.length || provided !== cfg.tickSecret) {
          return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
        }
        const ids = await dueIncidentIds();
        const results: { id: string; ok: boolean }[] = [];
        for (const id of ids) {
          try {
            await pumpIncident(id);
            results.push({ id, ok: true });
          } catch {
            results.push({ id, ok: false });
          }
        }
        return Response.json({ ok: true, processed: results.length, results });
      },
    },
  },
});
