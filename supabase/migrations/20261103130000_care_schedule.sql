/*
# Care schedule (a private month calendar for one signed-in person)

1. New Tables
- `care_events`: one row per planned care block (a check-in, a medication
  round, an appointment, a contact call). It stores the title, the start and end
  instants, and one of five card colours. There is no customer, booking or
  public-visibility column and no slot table: this is a personal schedule.

2. Security
- Row level security is enabled and the only policy is owner-only for ALL
  commands (`user_id = auth.uid()`). `anon` has no grant and no policy, so a
  visitor can never read or write another person's schedule.
- `user_id` defaults to `auth.uid()`, so a row can only be inserted for the
  signed-in person.
- Times are ordered by a table check (`ends_at > starts_at`) and a block may not
  be longer than 12 hours. Overlap is additionally rejected by the server
  function before it writes, so two blocks on one day never collide.

3. Modified Functions
- `clear_my_safety_data()` also deletes the signed-in person's care events, so
  the existing "delete my data" path keeps its promise.

4. Important Notes
- This migration seeds no events. Every row comes from a person using the
  calendar; the demo dates in the design reference are not inserted.
- `updated_at` is written by the server function on every change.
*/

CREATE TABLE IF NOT EXISTS public.care_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 80),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  color text NOT NULL DEFAULT 'stone'
    CHECK (color IN ('yellow', 'peach', 'lilac', 'sage', 'stone')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT care_events_time_order CHECK (ends_at > starts_at),
  CONSTRAINT care_events_max_length CHECK (ends_at <= starts_at + interval '12 hours')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_events TO authenticated;
GRANT ALL ON public.care_events TO service_role;
ALTER TABLE public.care_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own care events" ON public.care_events;
CREATE POLICY "own care events" ON public.care_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS care_events_owner_start_idx
  ON public.care_events (user_id, starts_at);

CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.care_events WHERE user_id = auth.uid();
  DELETE FROM public.alert_events WHERE user_id = auth.uid();
  DELETE FROM public.safety_preferences WHERE user_id = auth.uid();
  DELETE FROM public.contacts WHERE user_id=auth.uid();
  DELETE FROM public.incidents WHERE user_id=auth.uid();
  DELETE FROM public.profiles WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;
