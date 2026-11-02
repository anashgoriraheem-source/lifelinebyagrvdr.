/*
# Safety preferences (consent) and truthful alert-attempt states

1. New Tables
- `safety_preferences`: one row per user. Records the user's emergency jurisdiction and three
  explicit, default-off consents: automatic contact alerts, including location, and including
  medical details in alert content. `consent_updated_at` records when consents last changed.

2. Modified Tables
- `alert_attempts.status` now accepts only truthful delivery states:
  simulated, unavailable, queued, attempted, provider_accepted, delivered, acknowledged, failed, unknown.
  Legacy `sent` rows are mapped to `attempted` (a send was tried; delivery was never confirmed).
- `alert_attempts` gains `detail` (short reason text, never message bodies or phone numbers) and
  `attempt_count` for bounded retries.
- `clear_my_safety_data()` also deletes the caller's safety preferences.

3. Security
- RLS on `safety_preferences`: each user may read, insert and update only their own row.
- `anon` has no access. Attempt rows stay append-only from the browser (no UPDATE grant);
  only a future server-side delivery worker using service_role may change attempt status.
*/

CREATE TABLE IF NOT EXISTS public.safety_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  country_code text NOT NULL DEFAULT 'IN' CHECK (country_code IN ('IN', 'US', 'GB', 'EU', 'AU')),
  contact_alerts_consent boolean NOT NULL DEFAULT false,
  share_location_consent boolean NOT NULL DEFAULT false,
  share_medical_consent boolean NOT NULL DEFAULT false,
  consent_updated_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.safety_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.safety_preferences FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.safety_preferences TO authenticated;
GRANT ALL ON public.safety_preferences TO service_role;

DROP POLICY IF EXISTS "select_own_safety_preferences" ON public.safety_preferences;
CREATE POLICY "select_own_safety_preferences" ON public.safety_preferences FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_safety_preferences" ON public.safety_preferences;
CREATE POLICY "insert_own_safety_preferences" ON public.safety_preferences FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_safety_preferences" ON public.safety_preferences;
CREATE POLICY "update_own_safety_preferences" ON public.safety_preferences FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.alert_attempts DROP CONSTRAINT IF EXISTS alert_attempts_status_check;
UPDATE public.alert_attempts SET status = 'attempted' WHERE status = 'sent';
ALTER TABLE public.alert_attempts ADD CONSTRAINT alert_attempts_status_check CHECK (
  status IN ('simulated', 'unavailable', 'queued', 'attempted', 'provider_accepted', 'delivered', 'acknowledged', 'failed', 'unknown')
);
ALTER TABLE public.alert_attempts ADD COLUMN IF NOT EXISTS detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 200);
ALTER TABLE public.alert_attempts ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count BETWEEN 0 AND 5);

CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.alert_events WHERE user_id = auth.uid();
  DELETE FROM public.safety_preferences WHERE user_id = auth.uid();
  DELETE FROM public.contacts WHERE user_id = auth.uid();
  DELETE FROM public.incidents WHERE user_id = auth.uid();
  DELETE FROM public.profiles WHERE id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;
