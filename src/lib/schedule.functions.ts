import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { CARE_COLORS, MAX_BLOCK_MIN, type CareEvent } from "./schedule";

type Db = SupabaseClient<Database>;

/**
 * Care schedule server functions. Every call requires the signed-in person and
 * writes only their own rows — the database policy enforces the same rule, so a
 * crafted request cannot reach another account's schedule.
 */

const instant = z
  .string()
  .max(40)
  .refine((value) => Number.isFinite(Date.parse(value)), "That time could not be read.");

const eventInput = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give this event a name.")
    .max(80, "Keep the name to 80 characters or fewer."),
  startsAt: instant,
  endsAt: instant,
  color: z.enum(CARE_COLORS),
});

const id = z.string().uuid("That event could not be identified.");

type Row = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  color: string;
};

function toEvent(row: Row): CareEvent {
  return {
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    color: (CARE_COLORS as readonly string[]).includes(row.color)
      ? (row.color as CareEvent["color"])
      : "stone",
  };
}

function checkWindow(data: { startsAt: string; endsAt: string }) {
  const start = Date.parse(data.startsAt);
  const end = Date.parse(data.endsAt);
  if (!(end > start)) throw new Error("The end time must come after the start time.");
  if (end - start > MAX_BLOCK_MIN * 60_000)
    throw new Error("A single block cannot be longer than 12 hours.");
  return { start, end };
}

/** Reject a block that shares any instant with another block on the same day. */
async function assertFree(
  supabase: Db,
  userId: string,
  startsAt: string,
  endsAt: string,
  ignoreId?: string,
) {
  let query = supabase
    .from("care_events")
    .select("id")
    .eq("user_id", userId)
    .lt("starts_at", endsAt)
    .gt("ends_at", startsAt);
  if (ignoreId) query = query.neq("id", ignoreId);
  const { data, error } = await query.limit(1);
  if (error) throw new Error("Your schedule could not be checked. Try again.");
  if (data && data.length > 0)
    throw new Error("That time overlaps another event. Choose a free time.");
}

export const listCareEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ from: instant, to: instant }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const start = Date.parse(data.from);
    const end = Date.parse(data.to);
    if (!(end > start)) throw new Error("That date range could not be read.");
    if (end - start > 62 * 86_400_000) throw new Error("That date range is too large.");
    const { data: rows, error } = await context.supabase
      .from("care_events")
      .select("id,title,starts_at,ends_at,color")
      .eq("user_id", context.userId)
      .gte("starts_at", new Date(start).toISOString())
      .lt("starts_at", new Date(end).toISOString())
      .order("starts_at", { ascending: true });
    if (error) throw new Error("Your schedule could not be loaded. Try again.");
    return (rows ?? []).map(toEvent);
  });

export const createCareEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => eventInput.parse(data))
  .handler(async ({ context, data }) => {
    checkWindow(data);
    await assertFree(context.supabase, context.userId, data.startsAt, data.endsAt);
    const { data: row, error } = await context.supabase
      .from("care_events")
      .insert({
        user_id: context.userId,
        title: data.title,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        color: data.color,
      })
      .select("id,title,starts_at,ends_at,color")
      .single();
    if (error || !row) throw new Error("The event was not saved. Try again.");
    return toEvent(row);
  });

export const updateCareEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => eventInput.extend({ id }).parse(data))
  .handler(async ({ context, data }) => {
    checkWindow(data);
    await assertFree(context.supabase, context.userId, data.startsAt, data.endsAt, data.id);
    const { data: row, error } = await context.supabase
      .from("care_events")
      .update({
        title: data.title,
        starts_at: data.startsAt,
        ends_at: data.endsAt,
        color: data.color,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id,title,starts_at,ends_at,color")
      .maybeSingle();
    if (error) throw new Error("The event was not saved. Try again.");
    if (!row) throw new Error("That event no longer exists. Reload the month.");
    return toEvent(row);
  });

export const deleteCareEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: row, error } = await context.supabase
      .from("care_events")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw new Error("The event was not deleted. Try again.");
    if (!row) throw new Error("That event no longer exists.");
    return { ok: true as const };
  });
