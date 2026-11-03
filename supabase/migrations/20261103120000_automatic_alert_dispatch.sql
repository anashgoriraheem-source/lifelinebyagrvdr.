/*
# Automatic alert dispatch (SMS + voice) on top of the existing alert tables

1. New Tables
- `alert_settings`: one row per user with the explicit automation opt-in
  (`automation_enabled`), the selected triggers, the cancellation window, whether
  location is included, the identity used in the message and the call script,
  the escalation delay/rounds, and whether the account is still in test mode.
  Test mode is the default and live delivery needs a second deliberate toggle.
- `alert_incident_events`: append-only audit timeline for an incident (queued,
  countdown expired, message accepted, call ringing, acknowledged, canceled,
  failed, ...). Only the server (service role) writes it; the owner may read it.

2. Modified Tables
- `contacts`: adds `automation_consent`, `consent_at` and `consent_note` —
  the documented consent of a contact to receive automated messages and calls.
  Consent is never implied by having a phone number.
- `alert_events` becomes the incident row: `status`, `cancel_deadline`,
  `dispatch_started_at`, `resolved_at`, `canceled_at`, the location snapshot
  (`lat`, `lng`, `accuracy`, `location_at`, `location_source`), the settings
  snapshot used at trigger time, the escalation cursor (`next_action_at`,
  `round`) and `updated_at`. `mode` now allows `test` and `live`.
- `alert_attempts` records provider truth per contact and channel: `provider_sid`,
  the raw `provider_status`, `error`, `order_index`, `attempted_at`,
  `answered_at`, `acknowledged_at`, `completed_at`. Statuses cover the whole
  provider lifecycle, and "accepted" is never stored as "delivered".

3. Security
- RLS stays on: a user reads only their own settings and incident timeline, and
  writes only their own settings. `alert_events`/`alert_attempts` gain no UPDATE
  grant for `authenticated`, so status history cannot be edited from a browser;
  the dispatcher writes them with the server-side service role.
- `alert_incident_events` has no INSERT grant for `authenticated`.
- `replace_my_contacts()` stores the new consent fields; a contact cannot be
  marked consented without a timestamp.
- `clear_my_safety_data()` also deletes settings and the incident timeline.

4. Important Notes
- No provider is configured by this migration. With no credentials the
  dispatcher records `unavailable` attempts instead of pretending success.
- A provider "accepted" state is stored as `provider-accepted`; only a delivery
  callback moves an SMS to `delivered`.
*/

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS automation_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_note text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.alert_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  identity_name text NOT NULL DEFAULT '' CHECK (char_length(identity_name) <= 120),
  automation_enabled boolean NOT NULL DEFAULT false,
  test_mode boolean NOT NULL DEFAULT true,
  triggers text[] NOT NULL DEFAULT ARRAY['sos']::text[],
  countdown_seconds int NOT NULL DEFAULT 15 CHECK (countdown_seconds BETWEEN 0 AND 60),
  include_location boolean NOT NULL DEFAULT true,
  escalate_after_seconds int NOT NULL DEFAULT 45 CHECK (escalate_after_seconds BETWEEN 15 AND 300),
  max_rounds int NOT NULL DEFAULT 2 CHECK (max_rounds BETWEEN 1 AND 3),
  consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_settings TO authenticated;
GRANT ALL ON public.alert_settings TO service_role;
ALTER TABLE public.alert_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own alert settings" ON public.alert_settings;
CREATE POLICY "own alert settings" ON public.alert_settings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.alert_events
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'queued',
  ADD COLUMN IF NOT EXISTS cancel_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS dispatch_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS canceled_at timestamptz,
  ADD COLUMN IF NOT EXISTS lat double precision,
  ADD COLUMN IF NOT EXISTS lng double precision,
  ADD COLUMN IF NOT EXISTS accuracy double precision,
  ADD COLUMN IF NOT EXISTS location_at timestamptz,
  ADD COLUMN IF NOT EXISTS location_source text,
  ADD COLUMN IF NOT EXISTS settings_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS next_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS round int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.alert_events DROP CONSTRAINT IF EXISTS alert_events_mode_check;
ALTER TABLE public.alert_events
  ADD CONSTRAINT alert_events_mode_check CHECK (mode IN ('test', 'live'));

ALTER TABLE public.alert_events DROP CONSTRAINT IF EXISTS alert_events_status_check;
ALTER TABLE public.alert_events
  ADD CONSTRAINT alert_events_status_check CHECK (
    status IN (
      'queued', 'countdown', 'dispatching', 'escalating',
      'acknowledged', 'resolved', 'canceled', 'failed', 'blocked'
    )
  );

ALTER TABLE public.alert_attempts
  ADD COLUMN IF NOT EXISTS provider_sid text,
  ADD COLUMN IF NOT EXISTS provider_status text,
  ADD COLUMN IF NOT EXISTS error text,
  ADD COLUMN IF NOT EXISTS order_index int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS attempted_at timestamptz,
  ADD COLUMN IF NOT EXISTS answered_at timestamptz,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

ALTER TABLE public.alert_attempts DROP CONSTRAINT IF EXISTS alert_attempts_status_check;
ALTER TABLE public.alert_attempts
  ADD CONSTRAINT alert_attempts_status_check CHECK (
    status IN (
      'queued', 'simulated', 'provider-accepted', 'delivered',
      'call-initiated', 'ringing', 'answered', 'acknowledged',
      'failed', 'unavailable', 'canceled'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS alert_attempts_provider_sid
  ON public.alert_attempts (provider_sid) WHERE provider_sid IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.alert_incident_events (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.alert_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (char_length(kind) BETWEEN 1 AND 60),
  detail text NOT NULL DEFAULT '' CHECK (char_length(detail) <= 500),
  at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS alert_incident_events_event_at
  ON public.alert_incident_events (event_id, at);

GRANT SELECT ON public.alert_incident_events TO authenticated;
GRANT ALL ON public.alert_incident_events TO service_role;
ALTER TABLE public.alert_incident_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_incident_events" ON public.alert_incident_events;
CREATE POLICY "select_own_incident_events" ON public.alert_incident_events FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

REVOKE ALL ON public.alert_events FROM anon, authenticated;
REVOKE ALL ON public.alert_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.alert_events TO authenticated;
GRANT SELECT, INSERT ON public.alert_attempts TO authenticated;

CREATE OR REPLACE FUNCTION public.replace_my_contacts(_contacts jsonb) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF jsonb_typeof(_contacts) <> 'array' OR jsonb_array_length(_contacts) > 50 THEN RAISE EXCEPTION 'Invalid contacts'; END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(_contacts) c
    WHERE length(trim(coalesce(c->>'name',''))) < 2
       OR coalesce(c->>'phone','') !~ '^\+?[0-9]{3,15}$'
       OR (coalesce((c->>'emailAlerts')::boolean,false) AND length(trim(coalesce(c->>'email',''))) = 0)
       OR (coalesce((c->>'automationConsent')::boolean,false) AND coalesce(c->>'consentAt','') !~ '^[0-9]+$')
  ) THEN RAISE EXCEPTION 'Invalid contact'; END IF;
  DELETE FROM public.contacts WHERE user_id = auth.uid();
  INSERT INTO public.contacts(
    user_id, name, relationship, phone, call, sms, position, email, email_alerts,
    confirmed_at, test_destination, automation_consent, consent_at, consent_note
  )
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
         coalesce((c->>'testDestination')::boolean,true),
         coalesce((c->>'automationConsent')::boolean,false),
         CASE WHEN coalesce(c->>'consentAt','') ~ '^[0-9]+$'
              THEN to_timestamp((c->>'consentAt')::bigint / 1000.0)
              ELSE NULL END,
         left(coalesce(c->>'consentNote',''), 300)
  FROM jsonb_array_elements(_contacts) WITH ORDINALITY AS t(c,ordinality);
END $$;
REVOKE ALL ON FUNCTION public.replace_my_contacts(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_my_contacts(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.clear_my_safety_data() RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  DELETE FROM public.alert_events WHERE user_id = auth.uid();
  DELETE FROM public.alert_settings WHERE user_id = auth.uid();
  DELETE FROM public.safety_preferences WHERE user_id = auth.uid();
  DELETE FROM public.contacts WHERE user_id=auth.uid();
  DELETE FROM public.incidents WHERE user_id=auth.uid();
  DELETE FROM public.profiles WHERE id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.clear_my_safety_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_my_safety_data() TO authenticated;
