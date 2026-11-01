/*
# Tighten alert table grants

1. Modified Tables
- `alert_events` and `alert_attempts`: removes the default broad privileges Supabase grants to the anonymous and signed-in roles.

2. Security
- `anon` loses all access to both alert tables.
- `authenticated` keeps only the verbs the policies allow: SELECT and INSERT on attempts; SELECT, INSERT, and DELETE on events. UPDATE and TRUNCATE are not granted, so alert history is append-only from the browser.

3. Important Notes
- Row level security already blocked non-owners; this removes unneeded grants as defence in depth.
*/

REVOKE ALL ON public.alert_events FROM anon, authenticated;
REVOKE ALL ON public.alert_attempts FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.alert_events TO authenticated;
GRANT SELECT, INSERT ON public.alert_attempts TO authenticated;
