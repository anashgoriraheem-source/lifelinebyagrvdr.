# Device support, in plain words

This page describes exactly what Lifeline can read from a health device in a
web browser, what it cannot read, and how to tell the difference. It is written
from the code in `src/core/ble/` — not from a vendor compatibility list.

**No physical device has been verified with this build.** Compatibility below is
"the code implements this standard profile", not "this product works". A device
should be treated as unverified until someone records its model, firmware,
browser, operating system, the characteristics it exposed and the readings it
produced.

## What the app can read

Only the four standard Bluetooth SIG health services. Readings arrive as
notifications where the device offers them; a device that also allows reads has
its current value read once at connection (so a stored measurement appears
without waiting for the next one), and a characteristic that is readable but not
notifiable is re-read every 5 seconds. Each vital is subscribed once, through the
first characteristic that works.

| Reading | Service | Characteristic | Notes |
| --- | --- | --- | --- |
| Heart rate | Heart Rate `0x180D` | Heart Rate Measurement `0x2A37` | 8- and 16-bit values, energy expended and RR intervals are skipped correctly. If the device says it supports contact detection and reports no contact, the packet is rejected. |
| Blood oxygen | Pulse Oximeter `0x1822` | PLX Continuous `0x2A5F` **or** PLX Spot-check `0x2A5E` | SpO₂ and pulse rate. Both the streaming and the one-shot forms used by finger oximeters are decoded; whichever the device exposes is subscribed (never both at once). |
| Blood pressure | Blood Pressure `0x1810` | Blood Pressure Measurement `0x2A35` | Systolic/diastolic; kPa is converted to mmHg. The cuff's own timestamp is used when it is present and sane (last 7 days, not in the future); otherwise the browser's receipt time is used. |
| Blood glucose | Glucose `0x1808` | Glucose Measurement `0x2A18` | kg/L and mol/L values are converted to mg/dL. Historical record retrieval (RACP) is **not** implemented. |

### Two ways to find a device

1. **Find a health device** (default) — the browser's picker is filtered to
   devices that advertise one of those four services. This is the correct choice
   for a chest strap, a pulse oximeter, a BP cuff or a glucometer that is in
   broadcast/share mode.
2. **Show all nearby devices** — the browser's picker lists everything nearby,
   and the app then looks for the four standard services. Use this when a watch
   or band does not appear in the filtered list. If the device only exposes a
   vendor service, the app says so explicitly: it connected over GATT but there
   is no supported measurement service, so nothing is displayed.

## What a web page cannot read — do not expect otherwise

These are platform limits, not unfinished work:

- **Apple Watch** — data lives behind HealthKit, which is only available to a
  native iOS app with the user's permission. A web page cannot read it.
- **Wear OS / Android watches** — health data is exposed through Wear Health
  Services or Health Connect to native apps with granted permissions. There is no
  web API for either.
- **Vendor apps and clouds** (Garmin Connect, Fitbit, Samsung Health, Amazfit,
  boAt, Noise, …) — require the vendor's own app, account, approval and often a
  paid developer agreement. This app has no such integration and does not claim
  one.
- **Background or closed-tab monitoring** — Web Bluetooth only works while the
  page is open and in the foreground. No alarm can fire once the tab is closed or
  suspended.
- **A "paired" state** — Web Bluetooth has no pairing concept. The app shows
  *connected*, which means a GATT connection exists, never that monitoring works.

If your device keeps its data in a manufacturer app, the honest paths are: use
that app for its history, use a device that broadcasts a standard profile, or
keep using Lifeline without a device (contacts, SOS, first aid and location all
work).

## Browser and platform requirements

- Web Bluetooth is available in Chrome and Edge on Android, Windows, macOS and
  ChromeOS. It is **not** available in Safari (iOS, iPadOS, macOS) or Firefox.
- The page must be served over HTTPS (or `localhost`).
- On Android, Bluetooth and Location services must be switched on for the
  browser to list nearby devices.
- Another app holding the device's connection prevents the browser from
  subscribing. Close the manufacturer's app first.

## States the app distinguishes

| State | What it means | What to do |
| --- | --- | --- |
| Unsupported browser | Web Bluetooth is not present | Use Chrome or Edge; everything else in the app still works |
| Insecure page | The page is not HTTPS | Open the app over HTTPS |
| Connecting | The chooser returned a device; GATT is connecting | Wait a few seconds |
| Connected — waiting for a reading | GATT is up, no measurement has arrived | Start a measurement on the device; switch on share/broadcast; close the vendor app |
| Receiving readings | At least one reading is inside its freshness window | Check the timestamp shown under the status line |
| Out of date (stale) | Readings arrived but none is current | Move the device, take a new measurement, or connect again |
| Disconnected | The connection was lost | "Connect again" reuses the browser's permission without reopening the chooser |
| Connected but unsupported | GATT connected, no standard measurement service | Use the vendor app, or a device that broadcasts a standard profile |
| Rejected packet | The packet was malformed, mis-scaled or showed no sensor contact | Check the fit and take another measurement |

Freshness windows are display rules: 60 s for heart rate, 2 minutes for oxygen,
30 minutes for blood pressure and glucose. They are not clinical validity
periods.

## What the numbers mean

- Every reading shows its **source**, **unit**, **measurement time** and
  **arrival time**.
- Bluetooth readings are marked **unverified**. They are shown, timestamped and
  aged out, but they are **never used to raise an automatic alarm** in this build,
  because no packet has been validated against a reference device.
- Demo readings are labelled as synthetic everywhere and are never mixed into a
  real reading.
- Missing data stays missing: a rejected packet clears the reading rather than
  showing a previous value as if it were current.

## Verification record for this build

- Unit tests with synthetic `EventTarget` devices cover: connection without
  fabricating measurements, chooser cancellation, denied permission, unsupported
  services, read-only characteristics, the spot-check oximetry characteristic,
  the single read of a notifiable-and-readable value, invalid and implausible
  packets, loss handling, listener cleanup and the "all nearby devices"
  discovery mode (`src/core/ble/connect.test.ts`, `support.test.ts`,
  `parsers.test.ts`).
- Parser tests cover 8/16-bit heart rate, RR conversion, SFLOAT/FLOAT decoding,
  kPa→mmHg, conditional PLX fields (continuous and spot-check), glucose unit
  conversion, truncated packets, sentinel values and BP timestamps.
- The headless preview browser has no Web Bluetooth, so the pairing UI renders
  its "browser cannot connect" state there. Real chooser, permission, radio and
  device behaviour remain **not automatically verified**.
- Not tested: any physical watch, strap, oximeter, cuff or glucometer; iOS or
  Safari; screen-reader output for the device status region.

## Remaining dependencies before a real monitoring claim

1. At least one physical device of each class, with model/firmware recorded.
2. A clinical review of the freshness windows and any future alarm use of
   Bluetooth readings.
3. A native companion app (iOS HealthKit, Android Health Connect / Wear Health
   Services) if watch data from those platforms is genuinely required.
