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

## Deploy targets (Netlify / Vercel)

- `netlify.toml` sets the build command, `publish = "dist"` and `NODE_VERSION=22`
  (the offline-page step in `npm run build` needs Node >= 22.6 for
  `--experimental-strip-types`, and Vite 8 needs ^20.19 || >= 22.12).
- `vite.config.ts` builds Nitro's `netlify` preset only when Netlify runs the
  build (`NETLIFY=true`, set by Netlify itself). That output is `dist/` plus the
  handler in `.netlify/functions-internal/server`; the default Cloudflare Worker
  output has no `dist/`, which is why every Netlify deploy preview used to fail.
  With the flag unset (local, sandbox, Vercel) the Cloudflare default is kept.
- Reproduce a Netlify build locally with `NETLIFY=true npm run build`, then check
  `dist/index.html` exists and `.netlify/functions-internal/server/main.mjs`
  renders, e.g. `node -e "import('/app/.netlify/functions-internal/server/main.mjs').then(async m=>{const r=await m.default(new Request('http://localhost/'),{});console.log(r.status,(await r.text()).length)})"`.
  Both directories are git-ignored build output.

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
- No Twilio credentials are set in this workspace (the owner skipped the secrets
  card). The app boots and every other page works; `/alerts` reports the
  messaging provider as not configured, `saveAlertSettings` refuses live mode and
  test mode records the attempt instead of sending. Never describe automatic
  SMS or calls as working here until the values in `.base44/environment.json`
  are supplied and a real test destination is called.

## Care schedule calendar (`/schedule`)

- `src/components/CareCalendar.tsx`, `src/components/CareEventDialog.tsx` and
  `src/styles/care-calendar.css` are the adapted "Full Grid Calendar" design.
  Keep its load-bearing shape: seven equal Monday-first columns with a day's
  events at the TOP and its date pinned BOTTOM-LEFT, the separate day-name band
  where only today's column is filled with `--primary`, the first event of a day
  as a title-over-time card and every later one as a slim one-line card, the "+"
  hidden until the day is hovered or focused (faintly visible on touch), and the
  native `<dialog>` opened with `showModal()` so it lives in the top layer
  instead of being clipped by the card. Under 860px (`@container cc-root`) the
  grid becomes a day list with the date on TOP, empty days exactly 56px, and the
  card capped at 800px with inner scroll. Do not put `overflow: hidden` on the
  dialog or its form: the open time list hangs past the dialog's bottom edge.
- Data is real and private: `public.care_events` (one row per block, owner-only
  RLS, `ends_at > starts_at`, at most 12 hours) through
  `src/lib/schedule.functions.ts`. `src/lib/schedule.ts` holds every minute and
  grid calculation (`schedule.test.ts`); the pickers, the Save button and the
  server overlap check all use it, so a taken time is neither offered nor
  written. There is no customer/booking/slot model and no seeded demo events.
- Access: the route is private. A signed-out visitor sees only the sign-in gate;
  the calendar, the "+" and the dialog exist only for the owner, and the table
  policy limits reads and writes to `auth.uid()`. The page is reached from
  `/account`, deliberately not from the main nav. "Delete my data" and account
  deletion remove the rows via `clear_my_safety_data()`; the export includes
  them.
- Reminders are honest: "Next up" is shown only while the page is open and says
  so. No push notification, SMS reminder or external calendar sync is wired —
  never claim one.
- Verified in the preview with a throwaway account (deleted afterwards, along
  with its rows): the visitor gate, 7 header cells / 42 day cells, create at
  9 AM (single card tall, chosen colour), rename via the edit dialog, a second
  event (first stacked, later one inline), delete through the confirm footer,
  persistence across a full page reload (cross-checked directly in
  `care_events`), the phone day list with the date on top and no sideways
  scroll, and the time list capped at 172px. `npm test` (189) and
  `tsc --noEmit` pass. NOT re-verified in this session: the delete-confirmation
  copy assertion and the taken-time exclusion read from the add dialog (the
  delete itself worked and the rule is unit-tested and enforced server-side),
  keyboard/screen-reader traversal, and any second person's view — there is none.

## Field guide shelf (`/guide`)

- `src/components/FieldGuideMegaMenu.tsx`, `GuideShelf.tsx`, `GuideHandbook.tsx`
  and `src/styles/field-guide.css` are the adapted "Bookshop Header & Hero"
  design. Keep its shape: the department menu sits above the hero, the open
  catalogue panel covers it (hover, focus or tap; Escape and the dim close it),
  the handbook only turns while its own tile is hovered, and below 700px the
  departments live in a drawer rendered through a portal (the section sets
  `container-type`, which would otherwise clip a fixed child).
- Content comes from `src/data/fieldGuide.ts`, built over `GUIDES` in
  `src/lib/firstAid.ts`: a topic's number is its step count and "written to call
  first" means `call === "always"`. Do not add invented topics, prices or dates —
  the shelf is a catalogue of the guides the app already ships.
- Spines, cards and drawer rows link to `/assistant?guide=<id>`; that route
  validates the parameter and drops an unknown id.
- The panel uses its own wider padding (`--fg-panel-pad`) than the hero
  (`--fg-pad`, which lines the hero and shelf up with the page container); the
  three-column catalogue squeezed the handbook when both shared one width.
- Verified: `tsc --noEmit`, `npm run build`, `npm test` (213 pass; the
  `authErrors.test.ts` failure seen at the time was fixed later in this branch) and a
  Playwright pass over `/guide` at 1440/1265/390 px — no horizontal overflow,
  panel and handbook sized from their tiles, department hover and keyboard focus
  opening the panel, Escape closing it, the spine hover card inside the content
  edge, a spine click opening the right guide, the phone drawer in the portal
  with page scroll locked, and axe reporting no new violations. Not visually
  inspected in the preview in that session.

## Practice mode (`/practice`)

- `src/data/practice/` is the curriculum. `model.ts` defines the scenario shape
  and `buildLevel()`; `sources.ts` is the curriculum source register; `level1.ts`
  … `level10.ts` each hold ten scenarios; `index.ts` assembles exactly 10 levels
  × 10 scenarios (100 unique ids and titles). `practice.test.ts` enforces the
  counts, the 3–6 decision points, exactly one safe option per decision, the
  safe order, unsafe actions, emergency guidance, dispatcher report, sources and
  review status. Editing a level without keeping ten scenarios fails the suite.
- **Review status is deliberate.** Every scenario is `awaiting-clinical-review`
  with a null review date and `PRACTICE_GUIDANCE_VERSION` (2026.11.1). Do not
  change that, or remove the “Awaiting clinical review” labels, without a named
  clinician or recognised first-aid educator signing the content off. The
  curriculum is written in Lifeline's own words from the American Red Cross
  guidelines, WHO community first-aid resources, IFRC 2020 guidelines and, for
  India, the official ERSS 112 information. No source text is reproduced.
- `WITHHELD_SCENARIO_IDS` in `src/data/practice/index.ts` removes a scenario from
  the player and shows it as “Withheld” in the progress table. Withholding is
  separate from review status; an unreviewed scenario is still shown, labelled.
- `src/routes/practice.tsx` owns the level overview, the selected level, the
  progress table and the completion/reset summary. It renders
  `src/components/practice/ScenarioPlayer.tsx` for `?scenario=<id>` and
  `PracticeProgressTable.tsx` for the table. Both `level` and `scenario` search
  params are validated against the data.
- The player is a decision exercise, not a quiz: no timer and no speed score.
  Each answered decision reveals the consequence; `safeChoiceCount` marks the
  scenario `completed` only when every decision chose the safe option, otherwise
  `review-needed`. Progress is best-of: a later clean run completes a scenario
  and a later poor run never downgrades it. Pause keeps the session
  (`lifeline:practice:session:v1`), so the summary shows “You paused …” and the
  player resumes on the same decision with its explanation.
- **Safety boundary.** Practice code must not import `@/lib/sos`,
  `@/lib/alerts*`, `@/lib/dispatch*`, `@/lib/store` or `@/core/ble`, and must not
  call `raiseAlarm`, `dispatchEmergency`, `navigator.share` or geolocation.
  `practice.test.ts` scans the route and both components for those. The only
  emergency action is a user-initiated `tel:` link in the debrief, under “This is
  not the simulation”. Never add an SOS, automatic call/text, location share or
  Bluetooth action to practice.
- Progress: signed in, `public.practice_progress` is one owner-only row per
  scenario (RLS `user_id = auth.uid()`, `anon` has no grant) through
  `src/lib/practice.functions.ts`; `clear_my_safety_data()` deletes it. Signed
  out, the same record shape is kept in `lifeline:practice:v1` in this browser
  only. Do not add answers, patient details or free text to either store.
- The progress table is the adapted “data-table-1” design
  (`src/styles/practice-progress-table.css`, `.dt1-*`): keep the five filter
  pills with their travelling flood, the Export beam, the travelling row band,
  the entrance stagger, the 8-per-page pager and the phone card mode. Rows keep
  `data-order`/`data-customer`/`data-email`/`data-total`/`data-status`, and the
  pill counts are computed from the records. “Export CSV” and “Export selected”
  build a real CSV and download it (server rows when signed in, browser rows when
  signed out); they are not a toast-only stub.
- Emergency numbers come from the country selected in Contacts
  (`EMERGENCY_BY_COUNTRY`), so the copy stays configurable per jurisdiction.
- Verified with a scripted Chromium run against the dev server (not the preview
  pane): 10 levels, 10 scenarios per level, 100 rows, 8 per page, live pill
  counts; a full playthrough with feedback, debrief score, safe priority order,
  three source links, awaiting-review and review-date labels, `tel:112`, repeat,
  and no alarm dialog or `/api/alerts` call; guest progress persisted across a
  reload; table filter, empty state, pagination and both CSV downloads (101-line
  and 2-line files); 390 px player, debrief and table with no horizontal
  overflow; pause → reload → resume on the same decision; signed-in save via the
  real sign-in form (row `review-needed`, `best_safe` 2), anon read returned 0
  rows, Reset progress removed the row, and the throwaway account was deleted.
  `npm run typecheck`, `npm run build` and `practice.test.ts` (12 tests) pass; the
  full suite is 213 passing (the earlier `authErrors.test.ts` fixture mismatch is
  fixed in `classifyAuthFailure`).
  NOT verified: every one of the 100 scenarios was not played end to end in the
  browser (the data and its required fields are unit-tested), the
  withholding path has no withheld id to exercise, the level-complete panel
  appears only after all ten scenarios in a level, and no screen-reader or
  physical-device pass was done. Nothing here has clinical review.

## Movement and jolt monitor (`/monitor`)

- `src/lib/movementMonitor.ts` is the pure detector: one `createMovementMonitor()`
  fed `{x,y,z,t}` accelerometer samples (gravity included) returns
  `stillness` / `jolt` / `gap` events. Gravity is a slow low-pass of the vector,
  so stillness is measured on *linear* acceleration and a phone facing any
  direction (or being turned over) still reads as still. Stillness fires once at
  `stillnessMs` (60 s) and re-arms only after movement. A silence longer than
  `sampleGapMs` is a `gap`: the timer resets and it is never counted as
  stillness. A jolt needs a spike above `joltDynamicMs2` (27 m/s² ≈ 2.75 g) that
  also arrives fast (`joltJerkMs3`), is rejected when the preceding second shows
  sustained motion (walking/running mean ≥ 5.5 m/s²) or when it rises slowly
  (set-down, press), and is debounced for `joltDebounceMs`. `movementAvailability()`
  is the only place a monitoring phase is decided: unsupported hardware, an
  insecure page, a denied/absent permission, no stream, a stale stream and a
  backgrounded tab are all `unavailable` with a stated reason — never "active".
- `src/lib/movementRuntime.ts` owns the app's **only** `devicemotion` listener
  (mounted once by `MovementMonitorRunner` in `__root.tsx`), feeds both the
  existing fall detector and the new monitor from the same samples, and raises
  the existing alarm through `raiseAlarm`. `src/hooks/useMotion.ts` and the never
  mounted `MotionCard.tsx` were removed with that move; do not add a second
  listener. A jolt inside the fall detector's post-impact window is suppressed so
  one impact cannot raise two alarms, and `raiseAlarm` itself refuses while an
  alarm is open. Test mode is `runTrace()` over built-in synthetic traces: it
  never calls `raiseAlarm`, a provider or a contact, and `movementMonitor.test.ts`
  fails if that path gains an alarm/dispatch import.
- Alarm reasons gained `stillness`; `alert_settings.triggers` accepts
  `stillness` alongside `sos|vital|fall|jolt` (checked in `/alerts`). Demo/demo
  alarms are now stored as `mode: "test"` incidents server-side, so a simulated
  event can never reach a real contact even with live settings saved.
- The alarm screen names its source (`This alarm came from …`, sensor caveat for
  fall/jolt/stillness) and offers “I’m OK — cancel the automatic alert” during the
  countdown, which clears the alarm and lets `AlertRecorder` cancel the pending
  incident. No response still escalates through the saved contact workflow.
- Verified: `npm test` (234 tests, incl. 20 new detector/availability/alarm
  rules) and `tsc --noEmit`. In the preview at 1265 px and 375 px: the card's
  setup text, honest "Unavailable / no motion readings yet" state after Start in
  a headless browser, all five test-mode traces with their verdicts and no alarm
  dialog, no horizontal overflow, and a demo fall alarm whose dialog named the
  fall detector and was cleared by “I’m OK”.
  NOT verified: any real accelerometer, so the 60 s stillness alarm, a real jolt,
  permission grant/deny on iOS and Android, background suspension behaviour and
  the countdown → automatic escalation path were not exercised on hardware. The
  thresholds are conservative starting values, not calibrated on a device.
