import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { type AlertHistoryEvent } from "./alertPlan";

export const listAlertHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ events: AlertHistoryEvent[] }> => {
    const { supabase, userId } = context;
    const events = await supabase
      .from("alert_events")
      .select("id, reason_type, reason_label, reason_reading, is_demo, mode, started_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(20);
    if (events.error) throw new Error("Alert history could not be loaded. Try again.");
    const eventIds = events.data.map((e) => e.id);
    const attemptRows: {
      event_id: string;
      channel: string;
      contact_name: string;
      status: string;
      provider: string;
    }[] = [];
    if (eventIds.length > 0) {
      const attempts = await supabase
        .from("alert_attempts")
        .select("event_id, channel, contact_name, status, provider")
        .in("event_id", eventIds)
        .order("created_at");
      if (attempts.error) throw new Error("Alert history could not be loaded. Try again.");
      attemptRows.push(...attempts.data);
    }
    return {
      events: events.data.map((e) => ({
        ...e,
        attempts: attemptRows
          .filter((a) => a.event_id === e.id)
          .map((a) => ({
            channel: a.channel,
            contact_name: a.contact_name,
            status: a.status,
            provider: a.provider,
          })),
      })),
    };
  });
