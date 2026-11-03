/*
# Contact channels and safety preferences

1. Modified Tables
- `contacts`: adds the columns the account, export and assistant code already
  read — `email`, `email_alerts`, `confirmed_at` and `test_destination`. Existing
  rows keep their previous behaviour (no email channel, test destination on).
- `replace_my_contacts()` now stores those four fields from the same JSON array,
  and rejects an entry that enables email alerts without an address.

2. New Tables
- `safety_preferences`: one row per signed-in user holding the interface
  language and the two explicit consents (contact dispatch, location sharing)
  plus the time dispatch consent was first given.

3. Security
- RLS on `safety_preferences`: a user can only read, insert, update and delete
  their own row. Grants are limited to `authenticated`.
- `clear_my_safety_data()` also deletes the preferences row.

4. Important Notes
- Adding these columns makes the already-shipped read/export paths work; no new
  browser behaviour is introduced here.
- `confirmed_at` remains a self-confirmation timestamp. No OTP provider is
  configured, so it is not provider verification.
*/

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS email_alerts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS test_destination boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.safety_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language text NOT NULL DEFAULT 'en' CHECK (language IN ('en', 'hi')),
  dispatch_consent boolean NOT NULL DEFAULT false,
  share_location boolean NOT NULL DEFAULT false,
  consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_preferences TO authenticated;
GRANT ALL ON public.safety_preferences TO service_role;
ALTER TABLE public.safety_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own safety preferences" ON public.safety_preferences;
CREATE POLICY "own safety preferences" ON public.safety_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.replace_my_contacts(_contacts jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(_contacts) <> 'array' OR jsonb_array_length(_contacts) > 50 THEN RAISE EXCEPTION 'Invalid contacts'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_contacts) c
    WHERE length(trim(coalesce(c->>'name',''))) < 2
       OR coalesce(c->>'phone','') !~ '^\+?[0-9]{3,15}$'
       OR (coalesce((c->>'emailAlerts')::boolean,false) AND length(trim(coalesce(c->>'email',''))) = 0)
  ) THEN RAISE EXCEPTION 'Invalid contact'; END IF;
  DELETE FROM public.contacts WHERE user_id = auth.uid();
  INSERT INTO public.contacts(user_id,name,relationship,phone,call,sms,position,email,email_alerts,confirmed_at,test_destination)
  SELECT auth.uid(),
         c->>'name',
         coalesce(c->>'relationship','Other'),
         c->>'phone',
         coalesce((c->>'call')::boolean,true),
         coalesce((c->>'sms')::boolean,true),
         (ordinality-1)::int,
         nullif(trim(c->>'email'),''),
         coalesce((c->>'emailAlerts')::boolean,false),
         CASE WHEN coalesce(c->>'confirmedAt','') ~ '^[0-9]+$'
              THEN to_timestamp((c->>'confirmedAt')::bigint / 1000.0)
              ELSE NULL END,
         coalesce((c->>'testDestination')::boolean,true)
  FROM jsonb_array_elements(_contacts) WITH ORDINALITY AS t(c,ordinality);
END $$;
REVOKE ALL ON FUNCTION public.replace_my_contacts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_my_contacts(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.alert_events WHERE user_id = auth.uid();
  DELETE FROM public.safety_preferences WHERE user_id = auth.uid();
  DELETE FROM public.contacts WHERE user_id=auth.uid();
  DELETE FROM public.incidents WHERE user_id=auth.uid();
  DELETE FROM public.profiles WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;
