# Maps and the location globe

Two different surfaces, two different jobs. Both are fed by the same in-memory
record of location fixes, and neither invents a place.

## 1. The map (`src/components/LocationMap.tsx`)

- **Library:** [Leaflet](https://leafletjs.com/) 1.9 (`leaflet`, `@types/leaflet`),
  imported dynamically inside the map's effect so no route is tied to `window`
  at render time.
- **Tiles:** the OpenStreetMap standard tile server
  (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`), with the attribution
  control kept visible and complete
  (`© OpenStreetMap contributors`, linked to the copyright page).
- **What is drawn:** one marker at the fix, and a circle whose radius is the
  accuracy the browser reported. The zoom starts at 16 for a tight fix and 14
  when the accuracy is worse than 500 m — the map never pretends to be more
  precise than the fix.
- **States on screen:** loading, permission-denied, browser without location
  support, no fix yet, a current fix, and a fix older than the freshness window
  (`STALE_FIX_MS`, 2 minutes) which is labelled "Not current" in both the map
  pill and the card. Offline and tile failures show a plain-language banner; the
  coordinates stay readable underneath.
- **Controls:** recenter, follow-me (pans with each new fix), Leaflet's own
  zoom control, and explicit "Copy coordinates" / "Share location" buttons. The
  copy explains that copying only fills the clipboard — nothing is sent.

### Before a production deployment

The OpenStreetMap tile service is run by the OSM Foundation for the OSM project
and is used here under its published
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/): light,
attributed, no bulk downloading, and a valid app identity. That is appropriate
for a development preview and a small app, but it is **not** a commercial
hosting service.

If Lifeline gets meaningful traffic, or needs a different visual style, pick a
tile provider (a paid OSM-based provider, a self-hosted tile server, or a
commercial provider with a key) and:

1. Put the provider URL and the exact attribution string it requires in
   `TILE_URL` / `TILE_ATTRIBUTION` (`src/components/LocationMap.tsx`).
2. Put any key in the environment, never in source control — `set_secrets`, not
   a literal in the file.
3. Re-check the provider's terms for caching, rate limits and attribution.

No map key is required for the current setup, and none is configured.

## 2. The location globe (`src/components/LocationGlobe.tsx`)

Adapted from the "Map Infographic 3" Figma board (3511:1587).

- **The sphere is drawn, not photographed.** The canvas is painted from
  `MI3_LAND_RLE`, a run-length encoded 2° land/sea grid built from Natural Earth
  110m (public domain). Copy that string byte for byte; the engine verifies the
  run lengths (16200 cells, 5392 land) on first paint and logs a clear error if
  they do not add up. The canvas backing store is kept in sync with its CSS size
  at device pixel ratio.
- **The pins are real.** Each pin is a location fix this tab recorded, read from
  `places` in the store (`src/lib/places.ts`). Newest first, at most five, and a
  fix within 250 m of the leading one replaces it instead of adding a pin. With
  no fix there are no pins and the legend says so — the empty state is not a
  sample city list.
- **Nothing is persisted.** `places` lives in memory only, because the location
  card promises that a fix stays in this open tab. Reloading the page clears it.
- **Pins and legend are one control.** Hovering (or focusing) either half
  highlights both and holds the spin; clicking either half turns the globe so
  that place faces the viewer. Nothing stays selected. On a touch screen, where
  there is no hover, a tap shows the name for two seconds and then releases it.
- **Structure that must not be flattened:** `.lg-stage` is an empty spacer that
  gives the engine the globe's centre and resting radius while the canvas covers
  the whole board, so zooming grows the sphere behind the title and legend
  instead of cropping it into a rounded square. Each pin is three nested layers
  with one transform each (`.lg-pin` places and depth-scales, `.lg-pin-drop`
  animates the entrance, `.lg-pin-body` lifts on hover). The header and legend
  scrims are what keep the text readable over moving dots.
- **Zoom:** multiplicative, 0.5–2.0. Past ≈1.37 the sphere fills the board and
  bleeds off its sides on purpose; `.lg-globe-layer` clips it, which is the
  zoomed-into-the-map look. When every recorded place is close together the
  globe opens already zoomed enough to separate the pins (up to the same 2.0
  ceiling).
- **Motion:** the globe turns on its own about every 35 seconds, pauses while
  someone points at or focuses a place, and starts paused for anyone whose
  system asks for reduced motion. The third control is a pause/resume toggle
  whose icon, `aria-pressed` and label all follow the same state.

## Verified here

- Denied-permission state: driven through the real button in the preview
  browser; the card and map report the blocked permission and give next steps.
- Empty globe: sphere drawn, no pins, legend explains how a pin appears.
- Map tiles: OpenStreetMap tiles loaded in the preview (4 tiles at world zoom)
  with the attribution rendered.
- Not automatically verified: a granted location fix (the preview browser
  denies geolocation by default), so the marker, accuracy circle, follow, copy
  and share paths and the globe's pins were not driven end to end. Their maths
  is unit-tested in `src/lib/places.test.ts`.
