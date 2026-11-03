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

## Localization, voice and medical safety

- `src/i18n/messages/en.ts` is the reference catalog; `src/i18n/messages/packs.ts`
  holds the Hindi pack. It is complete for the catalogued surfaces but
  machine-drafted: no fluent speaker or clinician has reviewed it, and the
  picker says so. Adding an English key increases the denominator, so the
  language picker and the audit immediately report it as missing in every pack.
- Contacts (`messages/contacts.ts`) and the account page (`messages/account.ts`)
  keep their English and Hindi strings side by side; the Hindi object is typed
  against the English one, so a key without a Hindi counterpart fails the
  build. Data rendered from fixtures, the server or storage (relationship and
  country names, vital labels, provider policy steps, Supabase errors) is not
  in the catalog and is shown as received.
- Surfaces outside the catalog (home copy, the monitor readings detail and the
  emergency overlay) are still English-only. Never describe the app as fully
  localized in Hindi; run `auditLocale("hi")`.
- `src/i18n/coverage.ts` is the only source of truth for "is this language
  complete". Never label a locale complete from `locales.ts` alone; run
  `auditLocale()`/`describeLocale()`. `coverage.test.ts` fails if a required
  surface string is absent from English.
- `src/i18n/worldLanguages.ts` only labels translate-only languages. Actual
  support comes from the provider: `translationLanguages` calls LibreTranslate
  `/languages`; a model adapter returns `unverified` because it publishes no
  catalogue. Do not turn the world list into a promise.
- Interface direction comes from `locales.ts` and is applied to `<html dir>` by
  `I18nProvider`; use logical CSS properties (`ms-`/`me-`) so RTL mirrors.
- Voice support is reported per language from `speechSynthesis.getVoices()` in
  `VoiceSupport.tsx`. A headless browser legitimately reports zero voices; that
  is a device limitation to state, not a bug to hide.
- Medication guidance (`src/lib/medications.ts`) is disabled by default. It
  requires `MEDICATION_GUIDANCE_ENABLED=1` AND every entry marked
  `clinically-reviewed`; the env flag alone is not enough. Emergency symptoms,
  overdose and poisoning are evaluated before the gate and always win. The
  app never states a dose, brand, prescription choice or substitution. Run
  `medications.test.ts` after touching the reference or the factor checks.
- Assistant knowledge is versioned in `src/data/health-sources.ts`
  (`KNOWLEDGE_BASE`) and is never written by a model response.
- Translation provider: `TRANSLATE_API_URL` (+ optional `TRANSLATE_API_KEY`)
  configures a LibreTranslate-compatible service; without it
  `translationConfigured()` is false and `/translate` shows the explicit
  unavailable state. No provider is configured in this sandbox, so translation
  is NOT working — never describe it as live, and never mock a translation.

## Home hero and guided pairing

- `src/components/RisingTileHero.tsx` is the full-width home hero. `three` is a
  runtime dependency imported lazily inside the effect, so the home route must
  still render when WebGL is unavailable: the canvas is then hidden and the
  static `.rising-grid` floor in `styles.css` stays visible. Reduced motion
  stops the automatic tile cycle. Verify by loading `/` and confirming the
  `#rt-title`, the `/monitor` call to action and the status line render.
- The floating "First aid" launcher (`src/components/Assistant.tsx`) is fixed
  above the bottom bar on phones and covers whatever scrolls beneath it. On
  `/monitor` (marked `monitor-page`) it is hidden below 640px because it sat on
  the pairing status and its buttons; first aid stays one tap away in the
  Assistant tab. Keep new full-width forms in mind when adding it to a page.
- `src/components/DevicePairing.tsx` owns the guided Bluetooth flow on
  `/monitor`. It derives its state from `connectionPhase()` in
  `src/core/ble/support.ts` (never from GATT alone), translates device and
  browser errors into plain-language next steps, announces state through a
  `role="status"` region, and keeps "Continue without a device". The monitor's
  own status line calls the same `connectionPhase()`, so a quiet or stale
  connection can never read as "receiving" on one surface and not the other.
  SOS and first-aid stay outside it. Web Bluetooth cannot run in the headless
  preview browser: pairing, cancellation, denied permission and connection loss
  are manually verified only.

## Device readings and the readings dashboard

- The app is **Lifeline**. User-visible strings, page titles, the manifest and
  the offline page use that name. Internal identifiers deliberately keep their
  old `lifeline` prefix (`lifeline:settings:v1`, `lifeline:reading-days:v1`,
  `lifeline:locale`) so existing device-local data is not orphaned.
- `src/core/ble/connect.ts` has two discovery modes: `standard` filters the
  browser chooser by the four health services; `any` uses `acceptAllDevices` so
  a watch with only vendor services can still be selected, and is then reported
  as `unsupported-services` instead of a false "connected". Do not add vendor
  UUIDs speculatively — see `docs/device-support.md` for what a web page cannot
  read (HealthKit, Health Connect, vendor clouds).
- A dropped link is retried by the adapter while the page stays open: at most
  `MAX_RECOVERY_ATTEMPTS` (3) attempts at `RECOVERY_BACKOFF_MS` (1.5 s, 4 s,
  9 s), one attempt in flight, no retry while `pairing`, and `device.status`
  goes `reconnecting` with `device.recoveryAttempt`. `disconnectWearable()` is
  the stop signal: it cancels the timer, resets the count and sets
  `stoppedByUser`, so a person's disconnect is never undone by a timer. After
  the last attempt the status returns to `disconnected` with
  `device.error = "recovery-stopped"` and the card offers a manual reconnect.
  Coming back to the tab (`visibilitychange`) resets the counter and tries
  once, because a phone browser usually drops GATT while the tab is hidden.
  The browser may still refuse a grant-less `connect()`; that is what the
  manual button is for. Do not add a fourth silent attempt.
- `subscribe()` reports why a service did not start instead of swallowing it:
  `device.issues` holds `{ key, reason }` for `notifications-failed` (the
  service and characteristic exist but `startNotifications()` failed with no
  read fallback) and `characteristic-missing` (the service is there, the
  measurement is not). A missing service is *not* an issue — that is the
  ordinary "this device does not measure that" case, carried by `device.missing`.
  Notification clean-up removes the listener **and** calls `stopNotifications()`.
- Notifications are preferred, plus one read of the current value at connection
  when the device allows reads (`characteristic.properties.read`), so a stored
  measurement shows without waiting for the next push. A readable-only
  characteristic is polled every 5 s (`READ_POLL_MS`). Pulse oximeters may
  expose the continuous (`0x2A5F`) or spot-check (`0x2A5E`) characteristic;
  each vital is subscribed once, through the first one that works. One malformed
  or implausible packet clears that vital's reading and sets `device.error`; it
  is never replaced by a previous value.
- `src/core/ble/support.ts` is the single place that decides plausibility bounds,
  freshness, the connection phase and missing services. `DeviceState` carries
  `connectedAt`, `lastReadingAt`, `readingCount`, `servicesFound`, `missing`,
  `mode` and `lastInvalidAt`; keep them updated rather than recomputing in the UI.
- Demo readings have `quality: "good"`; Bluetooth readings are `uncertain` and
  are excluded from automatic alarms. Freshness windows in `detection.ts`
  (`MAX_AGE_MS`) are display rules that cover slow device update intervals, not
  clinical validity.
- `src/components/ReadingsDashboard.tsx` (home) renders only real aggregates:
  `src/lib/readingsOverview.ts` builds 12 month buckets from `readingDays`, which
  stores _which vitals were seen on a day_ and no values. `KEEP_DAYS` is 400 so
  the 12-month timeline has data; keep it value-free if you extend it.
- `src/components/ReadingMonthsChart.tsx` (on `/monitor`) is the isometric
  oval-disc "reading days by month" chart. Its shape is fixed (five tilted discs
  on a dashed 100% ring) and it must stay that shape. Values come from
  `src/lib/readingMonths.ts` over the same `readingDays` record — coverage of the
  month's _elapsed_ days, disc width relative to the dataset maximum, average
  across the five months. Colours are mixed from the theme tokens; no Google
  Fonts or third-party chart library. An empty record shows zeros, never a sample,
  and the caption says so; demo mode is labelled because the simulator writes to
  `readingDays` too.
- `supabase/migrations/20261101151559_contact_channels_and_preferences.sql` adds
  the contact channel columns and `safety_preferences` that the account code
  already read. `src/integrations/supabase/types.ts` is hand-maintained to match
  the migrations — update both together, then run `tsc --noEmit`.
- Verified here: `npm test` (159 tests), `tsc --noEmit`, `npm run build`, and the
  home/monitor screens in the preview at desktop and mobile widths, including the
  disc chart's empty state and its phone layout, and the session board at both
  widths. Not verified: any physical device, Web Bluetooth in a real browser,
  the disc chart rendered from a populated reading record in the browser (its
  maths is unit-tested; `readingDays` in the preview browser is re-seeded on
  every load), iOS/Safari, screen-reader output. `npm run lint` already fails
  repo-wide on older unformatted files; only new files were formatted.

## Location map and the location globe

- `src/lib/places.ts` is the only record of location the UI draws from: the
  fixes this tab received, newest first, at most five, in **memory only**. It is
  deliberately not persisted (the card promises a fix stays in this open tab),
  and `recordPlace` returns the same array for an unchanged leading fix so a
  once-a-second GPS watch does not re-render the page. `deleteDeviceLocalData`
  clears it with the rest of the session state.
- `src/components/LocationMap.tsx` is a real Leaflet map over OpenStreetMap
  tiles, with the OSM attribution kept visible. Marker = the fix; circle =
  the accuracy the browser reported. It shows loading, denied, unsupported,
  no-fix, current, stale ("Not current"), offline and tile-provider-error
  states. `fixIsStale` (re-exported there) is the one place "current" is decided
  together with `STALE_FIX_MS` in `sos.ts`. Provider choice, terms and the steps
  to swap it are in `docs/maps.md`.
- The map's starting zoom comes from `zoomForAccuracy()` in `src/lib/mapView.ts`
  (the accuracy circle spans about half the map), not a fixed street zoom: a
  1 km network fix used to open at zoom 16 with the circle far off screen. After
  the first fix the map pans and keeps the zoom the person chose, zooming out
  only if they are tighter than the accuracy supports; dragging turns follow
  off; recentring restores the accuracy-aware zoom. Zoom is the app's own 40 px
  buttons (Leaflet's control is not added), and a fix worse than 150 m
  (`accuracyIsCoarse`) gets a sentence naming the uncertainty.
- `src/components/LocationGlobe.tsx` + `src/styles/location-globe.css` are the
  adapted "Map Infographic 3" board: a canvas sphere drawn from the
  `MI3_LAND_RLE` land grid (copy it byte for byte; the engine verifies 16200
  cells / 5392 land), pins from `places`, and a legend that is one control with
  the pins. Do not flatten `.lg-stage` (empty spacer) out of the canvas layer,
  do not merge the three pin layers, and do not remove the header/legend scrims.
  Copy is English + Hindi inline, like `LocationCard`, so the i18n catalog
  denominator is unchanged.
- `/monitor` puts the location card and the globe side by side at `lg` and
  stacked below it; the location card is no longer inside the "more details"
  disclosure.
- `src/components/SessionMapInfographic.tsx` + `src/styles/session-map-infographic.css`
  are the adapted "Map Infographic" board under that row: the original card
  shape, 920 × 518 geometry, entrance sequence, count-up and pulsing pins are
  untouched; the content is the app's own. Pins come from `sessionPins()`
  (`src/lib/sessionMap.ts`) over `places` — at world scale fixes within
  `PIN_MERGE_M` (800 km) share one pin that says how many it stands for, and no
  pin is ever nudged off its coordinate. The two tickers are
  `device.readingCount` and the newest fix's accuracy. All copy is English +
  Hindi inline. The dot map is drawn from `src/lib/landGrid.ts`, the same
  verified 2° land grid the globe uses (the original artwork was decorative and
  did not follow a projection, so real coordinates could not be plotted on it);
  the shimmer keeps its dither and motion, tinted with the theme's primary.
  `worldDots.test.ts` is the projection test: known cities must be on land and
  known oceans on sea.
- `LocationMap.tsx` MUST import `leaflet/dist/leaflet.css` before
  `styles/location-map.css`. Leaflet positions every tile and pane from that
  stylesheet; without it the tiles keep `position: static` and the map paints as
  broken quadrants in the corner of its frame (the overlays still look fine, so
  check `.leaflet-tile` computed `position` rather than trusting the frame).
  `location-map.css` only restyles that DOM; it does not replace it.
- Verified in the preview at desktop (1265 px) and mobile (375 px): the map
  frame and OSM attribution render, the denied-permission path works from the
  real button, the globe draws its continents and its empty state, and there is
  no sideways scroll. A later audit found the tiles were laid out unpositioned
  (missing Leaflet CSS, now imported); after that fix `tsc --noEmit`,
  `npm run build` and `npm test` pass and the built CSS carries Leaflet's
  `position: absolute` rules, but the rendered tile grid was not re-captured in
  the same session — re-check it on the next `/monitor` pass. NOT verified: any
  granted location fix (the preview browser denies geolocation), so
  marker/accuracy/follow/copy/share and the globe's pins were not driven end to
  end; their maths is unit-tested.

## Automatic emergency alerts (SMS + automated calls)

- Provider: Twilio REST (`src/lib/alertProvider.server.ts`). Credentials are
  server-only secrets from `/run/base44/app.env`: `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` (voice sender; also SMS sender when
  no messaging service), optional `TWILIO_MESSAGING_SERVICE_SID`,
  `ALERT_PUBLIC_BASE_URL` (public https base for callbacks), `ALERT_TEST_PHONE`
  (the only number test mode may contact) and `ALERT_TICK_SECRET`. Nothing here
  may read the service key in client code or print a secret value.
- Data: `alert_settings` (explicit opt-in, triggers, countdown, include
  location, escalation delay/rounds, `test_mode`), `contacts.automation_consent`
  (+`consent_at`,`consent_note`), `alert_events` (one durable incident per alarm,
  unique `(user_id, idempotency_key)`, status/cancel deadline/location snapshot/
  settings snapshot/escalation cursor), `alert_attempts` (one row per contact and
  channel with provider sid and raw provider status) and `alert_incident_events`
  (append-only timeline). Browsers may read their rows; they cannot UPDATE them.
  The dispatcher writes with the service role.
- State truth: an SMS is `provider-accepted` until a delivery callback says
  `delivered`; a call is `ringing`/`answered`; only the keypad digit 1 stores
  `acknowledged`. `classifyProviderStatus` is the single mapping and
  `alertMessage.test.ts` pins it. Never present accepted as delivered, answered
  as acknowledged, or a failure as success.
- Flow: the browser creates the incident through `dispatchEmergency` (auth
  required). A countdown exists only for sensor alarms and its deadline is stored
  server-side; SOS dispatches immediately. `pumpIncident` claims state with
  conditional updates so replays and concurrent ticks cannot double-send. Calls
  go out one at a time in contact order and escalate after
  `escalate_after_seconds`, up to `max_rounds`.
- Durability: progression is driven by the starting request, the open page's
  polling, a server-side timer, and `POST /api/alerts/tick` with
  `x-alert-tick-secret`. A scheduled job calling that route is REQUIRED for
  escalation with no browser open; without it, the app says monitoring is not
  background.
- Callbacks: `POST /api/alerts/twilio/status` and `/api/alerts/twilio/ack`
  verify `X-Twilio-Signature` (`verifyTwilioSignature`) against
  `ALERT_PUBLIC_BASE_URL` and the form body before changing anything. Without
  credentials they return 503 rather than accepting unsigned reports.
- Test mode cannot reach real contacts: it contacts only `ALERT_TEST_PHONE`;
  with no such number every attempt is stored `simulated`/`test-sandbox` and the
  incident is `blocked` with a stated reason. Live mode is refused by
  `saveAlertSettings` while the provider is unconfigured.
- Public emergency numbers are never dialled by this workflow; the manual
  emergency actions on `/monitor` stay separate.
- `AlertRecorder` is mounted once in `src/routes/__root.tsx`. It is the only
  bridge from a raised alarm to a durable incident; deleting that mount silently
  disables the whole feature (that was the state before this work). The overlay
  reads `store.dispatch` for its status line, so its copy must never say "no call
  or message has been sent" while a dispatch exists.
- Verified in the preview with a throwaway account: consent recorded, settings
  saved, a test alert produced one incident + one SMS and one call attempt
  recorded as `Test only — not sent`, blocked reason shown, timeline present, no
  horizontal overflow at 375 px; a real SOS press created one non-demo incident
  with both channels stored as simulated/blocked (nothing sent, honest reason);
  the overlay showed the incident status; anon reads of `alert_events` are
  denied; `/api/alerts/tick` and the Twilio callback return 503 without
  credentials; the test account and its rows were deleted afterwards.
  NOT verified (no credentials/telephony): real SMS acceptance or delivery, call
  ringing/answered, keypad acknowledgement, escalation and retry timing, the
  countdown-then-auto-send path with a live provider, signature acceptance of a
  genuine Twilio callback, TRAI template/sender approval. Do not report those as
  working until a provider is configured and a real test destination is called.
