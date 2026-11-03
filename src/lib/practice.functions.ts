import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { practiceScenarioById } from "@/data/practice";
import type { PracticeProgress, PracticeProgressMap } from "./practice";

/**
 * Practice progress server functions. Every call requires the signed-in person;
 * the database policy limits reads and writes to `auth.uid()`. A signed-out
 * learner's progress stays in this browser only (see `src/lib/practice.ts`).
 */

type Row = {
  scenario_id: string;
  attempts: number;
  best_safe: number;
  total_decisions: number;
  status: string;
  last_practised_at: string;
};

const toProgress = (row: Row): PracticeProgress => ({
  scenarioId: row.scenario_id,
  attempts: row.attempts,
  bestSafe: row.best_safe,
  totalDecisions: row.total_decisions,
  status: row.status === "completed" ? "completed" : "review-needed",
  lastPractisedAt: row.last_practised_at,
});

export const listPracticeProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("practice_progress")
      .select("scenario_id,attempts,best_safe,total_decisions,status,last_practised_at")
      .eq("user_id", context.userId);
    if (error) throw new Error("Your practice progress could not be loaded. Try again.");
    const progress: PracticeProgressMap = {};
    for (const row of data ?? []) progress[row.scenario_id] = toProgress(row);
    return progress;
  });

export const recordPracticeAttempt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        scenarioId: z.string().min(3).max(24),
        safeChoices: z.number().int().min(0).max(12),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const scenario = practiceScenarioById(data.scenarioId);
    if (!scenario) throw new Error("That practice scenario is not in this version of the app.");
    const total = scenario.decisions.length;
    const safe = Math.min(data.safeChoices, total);
    const completed = safe >= total;

    const { data: existing, error: readError } = await context.supabase
      .from("practice_progress")
      .select("attempts,best_safe,total_decisions,status,last_practised_at")
      .eq("user_id", context.userId)
      .eq("scenario_id", data.scenarioId)
      .maybeSingle();
    if (readError) throw new Error("That practice attempt was not saved. Try again.");

    const bestSafe = Math.max(existing?.best_safe ?? 0, safe);
    const status = completed || existing?.status === "completed" || bestSafe >= total
      ? "completed"
      : "review-needed";

    const { data: row, error } = await context.supabase
      .from("practice_progress")
      .upsert(
        {
          user_id: context.userId,
          scenario_id: data.scenarioId,
          attempts: (existing?.attempts ?? 0) + 1,
          best_safe: bestSafe,
          total_decisions: total,
          status,
          last_practised_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,scenario_id" },
      )
      .select("scenario_id,attempts,best_safe,total_decisions,status,last_practised_at")
      .single();
    if (error || !row) throw new Error("That practice attempt was not saved. Try again.");
    return toProgress(row);
  });

export const resetPracticeProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("practice_progress")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error("Your practice progress could not be reset. Try again.");
    return { ok: true as const };
  });

export const exportPracticeCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ scenarioIds: z.array(z.string().max(24)).max(100).optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    let query = context.supabase
      .from("practice_progress")
      .select("scenario_id,attempts,best_safe,total_decisions,status,last_practised_at")
      .eq("user_id", context.userId)
      .order("scenario_id", { ascending: true });
    if (data.scenarioIds?.length) query = query.in("scenario_id", data.scenarioIds);
    const { data: rows, error } = await query;
    if (error) throw new Error("Your practice progress could not be exported. Try again.");
    return (rows ?? []).map(toProgress);
  });
