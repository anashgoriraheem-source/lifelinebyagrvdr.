/*
# Practice Mode progress (private to one signed-in learner)

1. New Tables
- `practice_progress`: one row per learner and scenario. It stores the attempt
  count, the best number of safe choices, the number of decision points, a
  status (`completed` or `review-needed`) and when it was last practised.
  No answers, no patient information, no free text and no clinical data.

2. Security
- Row level security is enabled and the only policy is owner-only for ALL
  commands (`user_id = auth.uid()`). `anon` has no grant and no policy.
- `user_id` defaults to `auth.uid()`, so a row can only be written for the
  signed-in person.
- A signed-out learner's progress is kept in their browser only and never
  uploaded.

3. Modified Functions
- `clear_my_safety_data()` also deletes the signed-in person's practice
  progress, so "delete my data" removes it with the rest.

4. Important Notes
- This migration seeds no progress. Nothing here represents certification,
  competence or clinical training.
*/

CREATE TABLE IF NOT EXISTS public.practice_progress (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  scenario_id text NOT NULL CHECK (char_length(scenario_id) BETWEEN 3 AND 24),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  best_safe integer NOT NULL DEFAULT 0 CHECK (best_safe >= 0),
  total_decisions integer NOT NULL DEFAULT 0 CHECK (total_decisions BETWEEN 0 AND 12),
  status text NOT NULL CHECK (status IN ('completed', 'review-needed')),
  last_practised_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scenario_id),
  CONSTRAINT practice_progress_safe_within_total CHECK (best_safe <= total_decisions)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_progress TO authenticated;
GRANT ALL ON public.practice_progress TO service_role;
ALTER TABLE public.practice_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own practice progress" ON public.practice_progress;
CREATE POLICY "own practice progress" ON public.practice_progress FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.practice_progress WHERE user_id = auth.uid();
  DELETE FROM public.care_events WHERE user_id = auth.uid();
  DELETE FROM public.alert_events WHERE user_id = auth.uid();
  DELETE FROM public.safety_preferences WHERE user_id = auth.uid();
  DELETE FROM public.contacts WHERE user_id=auth.uid();
  DELETE FROM public.incidents WHERE user_id=auth.uid();
  DELETE FROM public.profiles WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;
