<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Running this repo in the Base44 sandbox
`docker compose -f docker-compose.base44.yml up -d --build` starts the Vite dev
server on host port 3000 plus a local Supabase stand-in (Postgres, GoTrue auth,
PostgREST behind nginx) on host port 8000 at `/auth/v1` and `/rest/v1`. The app
expects `SUPABASE_URL` (server, internal), `VITE_SUPABASE_URL` (browser, public)
and the publishable/service keys; all of them are supplied by compose.

- `.env.base44-defaults` holds generated development-only credentials for that
  local stack. `/run/base44/app.env` (dashboard secrets) is listed last on the
  web service so real values override the defaults. The defaults are local
  values, not credentials for a hosted project.
- `supabase/local/init/00-roles.sh` creates the Supabase roles and `auth` schema
  on a fresh database volume. `auth.uid()`/`auth.role()` come from GoTrue's own
  migrations (they need to own them), so PostgREST runs with
  `PGRST_DB_USE_LEGACY_GUCS=true`, which those functions read.
- The one-shot `migrate` service re-applies `supabase/migrations/*.sql` on every
  start and then reloads the PostgREST schema cache. It runs as the database
  superuser because the migrations create triggers on `auth.users`.
- The published PostgREST image is shell-less, so compose copies its binary onto
  `node:22` to give the healthcheck a probe.
- On a fresh database volume the `db` log shows one
  `ERROR: relation "schema_migrations" does not exist` at startup. That is
  GoTrue's own migrator probing for `auth.schema_migrations` before it creates
  it (the same second logs `GoTrue migrations applied successfully`). It is
  harmless and does not recur; do not pre-create that table.
- `vite.config.ts` changes defaults only when `BASE44_PREVIEW_MODE=1` (the
  sandbox flag): port 3000 and the preview hostname in `allowedHosts`. Unset or
  any other value keeps the original port-8080 defaults.
- No SMTP is configured: sign-up auto-confirms, but password-recovery emails are
  not delivered.
- Reset local data with `docker compose -f docker-compose.base44.yml down -v`.
- End-to-end check: sign up on `/account`, add a contact on `/contacts`, press
  "Save contacts to account", then sign out and back in — the contact reloads
  from Postgres. Tests:
  `docker compose -f docker-compose.base44.yml exec -T web npm test`.

## Application architecture
- Keep TanStack file routes and the existing device store; uploaded source must be adapted rather than replacing live Bluetooth or Cloud boundaries.
- Use the global semantic theme and shared Button for feature controls so safety states and touch targets remain consistent.
- Keep multilingual matching local and phrase-backed; unsupported input remains unchanged and medical guidance language is explicitly shown.
- Validate persisted device-local settings with the shared schema and write only when settings change to avoid high-frequency storage work.
- Decode standard Bluetooth packets strictly and reject absent or malformed values rather than supplying defaults.
