# Aapda Setu / Lifeline — RC1 review handoff

**Date:** 2026-11-02. **Disposition: review build, NOT approved for commercial go-live.**
This archive contains implemented source changes, automated tests, a public-only offline fallback and evidence. It is not merely a visual prototype. It does not satisfy every release gate in the request: approved Hindi first-aid translations, whole-app Hindi localization, clinical/jurisdiction reviews, physical hardware validation and hosted-provider/account verification remain incomplete. Do not market it as ready, medically certified, universally accessible or able to guarantee help.

## 1. Inspection and baseline

The supplied ZIP, not a connected upstream working tree, was the available project. It had no `.git` metadata; therefore upstream uncommitted changes or branch status could not be determined. An untouched local baseline commit was created solely to produce a review patch. No upstream history was changed or pushed.

Read root `AGENTS.md`, README, roadmap, route conventions, deployment/Vite configuration, the bundled older archive's AGENTS/PLAN/offline notes, and actual routes, device store, BLE parsers, account/server boundaries, settings validation and SQL ownership policies. Protected/generated integration files and the supplied embedded ZIP were left unchanged. The old bundled archive is a reference, not the live application.

The baseline was not buildable as supplied: locale metadata, knowledge/composer, authentication/rate-limit/AI and dispatch modules were missing. Three test suites could not load; four suites/28 tests ran successfully. TypeScript reported missing imports and follow-on errors. Existing documentation mixed older plans with current implementation. In particular, BLE automatic reconnect really existed, the app referenced automatic dispatch that was missing, and the active application had a manifest but no service worker. Earlier offline claims were not evidence of offline readiness in this archive. Cloud/auth code and local-compose configuration exist; that is different from a verified hosted account service.

## 2. Implemented changes and working review journeys

- Repaired missing imports with functional locale resources and local first-aid lookup; generative health AI and automatic delivery are explicitly blocked, not mocked or silently enabled by credentials.
- Simplified Home and Monitor into numbered next steps, honest reading states and accessible emergency/first-aid paths that do not depend on pairing. Removed decorative 3D rendering and high-risk experimental motion controls from the primary journey; their existing source files remain for review.
- Added ordinary click/keyboard emergency actions rather than mandatory press-and-hold. The emergency dialog traps focus, supports Escape, returns focus to its opener and announces truthful status. Dialling and SMS are external handoffs only; no delivery/acknowledgement/dispatch status is invented. Demo actions disable real contact links.
- Location and medical details are excluded from drafts by default. Each incident starts with sharing off, explicit checkboxes and a readable preview. Default and test drafts from the shared message builder also exclude private profile/readings/location. Opening a link is never described as a completed call or sent message.
- Added device-local export and confirmed deletion, bounded stored input, corrupt-storage preservation and storage-error notices. Export files are sensitive and must be stored carefully. Deletion targets this app's known keys only, not other apps' browser data. Cloud data requires separate account deletion.
- Removed automatic coordinate-bearing map embeds; opening a map is a separate explained action. Readings/location are stopped or cleared on page hiding/account identity changes. App suspension is announced; it does not promise closed-app alerts.
- Added a public-only offline page with 18 existing English draft guides and English/Hindi controls. Its worker caches only `/offline.html`; no account page, contacts, health records, dynamic HTML, server functions or translation responses are cached. It is a limited offline fallback, not a fully offline application. First installation requires network; device/browser eviction and real phone install behavior remain unverified.
- Pinned Vite 8.3.5 and Zod 4.6.7 after the dependency audit identified advisories; typecheck and all tests were rerun after upgrading. Use the npm lockfile; the supplied Bun lockfile is historical and was not regenerated.

## 3. First-time usability and accessibility

Plain setup instructions explain device proximity/power, secure pages, the browser's device list and permission choices before pairing. Status uses text, not color alone. The no-device path stays visible even in unsupported browsers. Stable heading structure, labels, skip link, 44px-class targets, wrapping buttons, live status regions, reduced-motion CSS and locale-aware date/number formatting are implemented. External font downloads were removed from the primary shell.

**Actually tested:** headless Chromium 156.0.8078.4 on Ubuntu 24.04.5 LTS / Linux 6.18.15; Playwright 1.64.1; axe-core 4.14.0. Seven routes (`/`, `/monitor`, `/contacts`, `/account`, `/assistant`, `/translate`, `/saath`) × two locale selections × widths 320, 390, 768, 1280 = **56 browser cases**, no horizontal overflow and zero axe violations for the selected WCAG 2 A/AA, 2.1 AA and 2.2 AA tags. Monitor passed 200% root text resizing at 390px. Keyboard activation, skip navigation, modal focus containment/return, and live-region attributes were exercised. Browser context requested reduced motion. First-run contrast, wrapping and focus-return findings were fixed and the suite rerun.

**Not tested:** real phones/tablets, Safari/WebKit, Firefox, screen-reader users, NVDA/JAWS/VoiceOver/TalkBack, actual browser 200%/400% zoom, all open form/dialog/error permutations or every user need. Automated DOM/axe checks do not certify WCAG compliance or prove that a screen reader actually announced text correctly. These remain release gates.

## 4. Bluetooth behavior and limits

Pairing only starts from “Open the device list.” Chooser opening is distinct from connecting; connection without packets explicitly waits for a reading. Cancellation, denied permission, range/network failure, unsupported/insecure contexts, unsupported services and loss have different recovery paths. Malformed packets clear the affected reading and announce a next step. Loss clears current readings and removes listeners; retry is manual. Old-device events cannot overwrite a newer session. No brand-level support claims, battery/signal claims, remembered-device promise or background/reconnect guarantee is made.

Implemented standard paths: Heart Rate 0x180D/0x2A37; **continuous** Pulse Oximeter 0x1822/0x2A5F; Blood Pressure 0x1810/0x2A35; Glucose 0x1808/0x2A18. This is code coverage, not a supported-device certification list. PLX spot-check-only devices, vendor-specific services, historical glucose retrieval/RACP, authoritative device timestamps, measurement-status interpretation and broad device models are not verified. Receipt time is used where the device clock/history cannot be established. BLE packets are deliberately `uncertain` and are **not used for automatic threshold alarms** pending hardware/clinical validation. Some devices send only after a measurement; another app may hold the connection.

**Physical hardware tested: none.** Chooser/packet/connection outcomes were synthetic test doubles in jsdom/Chromium. No real Bluetooth packet, radio, OS permission chooser or physical-device compatibility was validated. Owner must record exact device model/firmware/browser/OS, subscribed characteristics, timing, reading accuracy and failure outcomes before enabling real monitoring claims.

## 5. Localization and actual translation API

Interface resources ship for `en-IN` and `hi-IN`; the choice persists, updates document language, and works without calling a translation provider. Catalog tests check key coverage and placeholder consistency. New setup, readings and emergency-action resources are bundled. Hindi is machine-drafted and **not approved**. Some legacy directory data, free-form/provider/server text and English-only first-aid instructions remain; English first-aid content is explicitly marked and spoken as English. Catalog coverage is not whole-product localization. **Full Hindi localization required by the request is not finished.** No qualified language or clinical review is claimed. See `release-evidence/content-review-register.json` for source/version/reviewer/date gaps.

A real server-side LibreTranslate transport is implemented behind TanStack's POST `translateText` server-function endpoint; `/translate` is the UI, not a fabricated REST path. It calls the configured provider's `/languages` and `/translate`, requires an affirmative consent field, allows only four fixed public setup phrases and `en`/`hi`, and checks provider-reported language/pair availability. Arbitrary health information, precise location, contacts, images and emergency instructions are not accepted. No machine output is substituted for the bundled controls or first-aid text. Input is bounded/validated, same-origin CSRF protection is retained, redirects are refused, outbound calls have an 8-second timeout each, provider payloads are capped at 64 KB, and failures return an explicit unavailable/error state without model fallback.

**Actual service status: BLOCKED / not live verified.** No provider account, credentials, approved hosting/data agreement or live request was available. Network success tests use explicit test fixtures only; they do not establish provider connectivity. Required operator configuration:

1. Provision an approved LibreTranslate-compatible HTTPS service, including actual English↔Hindi models/pairs and a `/languages` response that reports targets.
2. Set server-only `TRANSLATE_API_URL` and, if required by that service, `TRANSLATE_API_KEY`. Never use `VITE_` secrets. No credential values are in this handoff.
3. Confirm current plan, quotas, billing, hosting region, retention/logging, subprocessors and data agreement. The software is downloadable/self-hostable; compute and operation still cost money. No free hosted quota or specific price is assumed.
4. Run an owner-authorized staging test using only the allowlisted public phrases. Record success, failure, timeout and quota behavior before calling it live.

The in-process request limiter groups unauthenticated callers into a global budget and ignores spoofable forwarded addresses as identity. It is **not distributed abuse protection**. Add trusted-edge request-size/rate limits, concurrency controls, monitoring and operational budgets before go-live. Per-user quotas alone do not establish a global cost cap. Arbitrary user-text translation remains intentionally out of scope until consent and an approved health-data-handling design exist.

Provider/security references actually retrieved during review: https://docs.libretranslate.com/api/operations/translate/ ; https://libretranslate.com/ ; https://developer.chrome.com/docs/capabilities/bluetooth . These document interfaces/limits, not approval of this application.

## 6. Data/security and account boundary

Primary first-aid search runs locally. The generative provider adapter returns disabled even if AI keys are present, preventing accidental transmission of stored health/contact/image context. New auth lookup verifies bearer tokens with Auth instead of trusting user IDs. Account handlers use authentication middleware, owner-scoped queries and supplied RLS policies. SQL inspection confirmed the older shared-incident RPC is already revoked by the later private-safety migration; it was not falsely treated as an open public feature.

The supplied hosted types/account handlers reference `safety_preferences`, extended contact email/confirmation fields and newer alert state that are not fully represented by the supplied SQL migrations. **This schema drift is a real account-release blocker.** No hosted database, migrations, cross-user A/B tests, account recovery, export/deletion end-to-end or provider callbacks were executed. Local compose defaults are development-only and were preserved but not launched or used as hosted credentials. Required account environment names (when an owner provisions it) include `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, browser-public `VITE_SUPABASE_URL`/`VITE_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY` for the existing admin deletion path. Correct schema/migrations, configure email recovery, test ownership/deletion and obtain security/privacy approval before enabling it for real people.

Device-local contacts/profile/preferences are not encrypted against someone using the same browser or XSS. Explain shared-device exposure, browser data deletion/eviction, account retention/backups and export handling in the approved privacy notice. The deployment still needs a reviewed security-header/CSP policy, trusted body-size/rate limits, operational logging/retention controls and independent security testing. Zero dependency advisories is not a penetration test or compliance evidence.

## 7. Checks and exact disposition

| Check | Actual outcome |
|---|---|
| `npm ci --no-audit --no-fund` on supplied lock | Passed baseline installation |
| `npm test` after final dependencies | 10 files / **83 tests passed** |
| `npm run typecheck` | Passed |
| `npm run build` | Passed; generated local build only, no deployment |
| `npm run test:browser` against localhost | **16 journeys passed**, 56 matrix cases; no page errors, no external HTTP requests |
| Offline fallback | Saved only public `/offline.html`, reloaded offline, 18 draft guides available; Hindi controls switched offline |
| Changed TypeScript/CJS source lint | Exit 0, zero errors, seven warnings (hook/fast-refresh) |
| Whole repository `npm run lint` | **Fails**; mostly Prettier issues in legacy/unformatted files. See exact captured log. Not waived as passing. |
| `npm audit --omit=dev` after updates | Exit 0, zero known runtime audit findings at this run |
| `git diff --check` | Passed |
| Physical BLE / real call or message / live provider / hosted account / actual assistive technology | **Not run** |

Tests used synthetic data and no real emergency contacts. No telephone/SMS links were followed during testing. No live alerts, production data changes, public app URL, deployment or credential provisioning occurred. Build warnings include framework server-function deprecations and bundle-size considerations; build success is not production approval. Reproduce locally with Node 22, `npm ci`, `npm test`, `npm run typecheck`, `npm run build`; in a separate local terminal start `npm run dev -- --host 127.0.0.1`, install Playwright Chromium/system dependencies, then run `npm run test:browser`. The browser runner refuses a non-local target. It temporarily mocks Bluetooth and blocks external HTTP requests; those fixtures are not in the application flow.

## 8. Go-live gates and owners

| Owner | Required action before public/commercial release |
|---|---|
| Product + engineering | Finish remaining whole-product Hindi localization; resolve repository lint; reconcile documentation and supported-surface scope. Keep incomplete capabilities visibly blocked. |
| Qualified clinician + first-aid lead | Review each adult guide, warning/threshold behavior, source versions, contraindications/scope and jurisdiction-specific adaptation; record reviewer/date/version. No clinical sign-off currently exists. |
| Qualified Hindi language reviewer + clinician | Approve safety-critical wording, instructions, units/plurals and speech behavior; complete the English-only content gap. Machine drafts alone are insufficient. |
| Hardware QA | Test named physical devices/firmware with exact browser/OS and failure conditions; validate timestamp/quality/readings before enabling medical alarms. |
| Accessibility lead + representative users | Test real touch devices, actual zoom and screen readers in both languages, all form/error/dialog journeys and reduced motion. Target WCAG 2.2 AA; do not infer conformance from axe. |
| Backend/security engineer | Fix schema drift, verify migrations in an isolated authorized environment, prove user A cannot read/update/delete user B, test recovery/export/deletion and rate/body limits. |
| Privacy/legal/regulatory/jurisdiction owners | Approve notices, consent, lawful sharing, data minimization/retention, provider agreements, medical-device positioning and official emergency numbers/helpline directory. Regional numbers beyond implemented selections need review. |
| Operator/provider owner | Provision translation service and verify plan/pairs/retention/quotas in staging; distribution-safe limits, runbooks, uptime/error monitoring and incident support. Automatic alert delivery remains disabled. |

## 9. Most relevant files

- `src/core/ble/connect.ts`, `connect.test.ts`, existing strict packet parsers.
- `src/components/DevicePairing.tsx`, `AlarmOverlay.tsx`, `SosButton.tsx`, `VitalCard.tsx`, `LocationCard.tsx`, shared `ui/button.tsx`.
- `src/routes/index.tsx`, `monitor.tsx`, `assistant.tsx`, `translate.tsx`, account/contact adjustments.
- `src/i18n/locales.ts`, `messages/release.ts`, English/Hindi catalogs and coverage tests.
- `src/lib/translationPolicy.ts`, `translate.functions.ts`, `translate.server.ts`, provider tests and `rateLimit.server.ts`.
- `src/lib/store.ts`, `settings.ts`, `sos.ts`, `releaseSafety.test.ts`, `DevicePrivacy.tsx`, `RuntimeNotices.tsx`.
- `scripts/build-offline.ts`, `public/offline.html`, `public/sw.js`, `scripts/release-check.cjs`.
- `package.json`, npm lockfile, `release-evidence/` and review patch.

Keep the supplied AGENTS/older roadmap claims in context: this handoff describes what actually ran for this candidate, not a blanket endorsement of previous claims.
