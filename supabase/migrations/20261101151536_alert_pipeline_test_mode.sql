/*
# Alert pipeline (test mode): alarm events and attempt tracking

1. New Tables
- `alert_events`: one row per alarm raised while signed in. Holds the alarm type, label, reading text, whether it was a demo, the time it started, and a client-generated idempotency key so the same alarm is never recorded twice.
- `alert_attempts`: one row per planned contact action (SMS or call) for an alarm event. Holds the channel, the contact it targets, the provider name, and a status.

2. Modified Tables
- `clear_my_safety_data()` now also deletes the signed-in user's alert events (attempts are removed by cascade). Otherwise it behaves as before.

3. Security
- Row level security is enabled on both tables.
- Each user can only read, insert, and delete rows they own (`user_id = auth.uid()`). There is no UPDATE grant or policy, so alert history cannot be edited from the browser.
- Grants are limited to `authenticated` (plus `service_role` for server-side tooling).
- Attempt status values are constrained so only known states can be stored.

4. Important Notes
- Test mode only: the `mode` column is constrained to `test`. Rows record what WOULD be sent; nothing is delivered to any phone or provider.
- Idempotency: a unique index on (user_id, idempotency_key) prevents duplicate events, and a unique index on (event_id, contact_id, channel) prevents duplicate attempts.
- Deleting a user cascades to all their alert rows through the foreign key to auth.users.
*/

CREATE TABLE IF NOT EXISTS public.alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  mode text NOT NULL DEFAULT 'test' CHECK (mode = 'test'),
  reason_type text NOT NULL CHECK (reason_type IN ('vital', 'fall', 'jolt', 'sos')),
  reason_label text NOT NULL CHECK (char_length(reason_label) BETWEEN 1 AND 200),
  reason_reading text NOT NULL DEFAULT '' CHECK (char_length(reason_reading) <= 300),
  is_demo boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_events_user_idempotency_key
  ON public.alert_events (user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS alert_events_user_started_at
  ON public.alert_events (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.alert_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.alert_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  contact_name text NOT NULL CHECK (char_length(contact_name) BETWEEN 1 AND 200),
  channel text NOT NULL CHECK (channel IN ('sms', 'call')),
  provider text NOT NULL DEFAULT 'test-sandbox',
  status text NOT NULL DEFAULT 'simulated' CHECK (status IN ('simulated', 'queued', 'sent', 'delivered', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS alert_attempts_event_contact_channel
  ON public.alert_attempts (event_id, contact_id, channel);
CREATE INDEX IF NOT EXISTS alert_attempts_user_id ON public.alert_attempts (user_id);

ALTER TABLE public.alert_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_attempts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.alert_events TO authenticated;
GRANT SELECT, INSERT ON public.alert_attempts TO authenticated;
GRANT ALL ON public.alert_events TO service_role;
GRANT ALL ON public.alert_attempts TO service_role;

DROP POLICY IF EXISTS "select_own_alert_events" ON public.alert_events;
CREATE POLICY "select_own_alert_events" ON public.alert_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_alert_events" ON public.alert_events;
CREATE POLICY "insert_own_alert_events" ON public.alert_events FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_alert_events" ON public.alert_events;
CREATE POLICY "delete_own_alert_events" ON public.alert_events FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "select_own_alert_attempts" ON public.alert_attempts;
CREATE POLICY "select_own_alert_attempts" ON public.alert_attempts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_alert_attempts" ON public.alert_attempts;
CREATE POLICY "insert_own_alert_attempts" ON public.alert_attempts FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM public.alert_events e WHERE e.id = event_id AND e.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.alert_events WHERE user_id = auth.uid();
  DELETE FROM public.contacts WHERE user_id=auth.uid();
  DELETE FROM public.incidents WHERE user_id=auth.uid();
  DELETE FROM public.profiles WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;
