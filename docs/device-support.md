# Device and sensor support

Lifeline is a web application. It does not currently include a native Android or
iOS companion app, and it does not connect to smartwatches or vendor health
services.

## Physiological readings

Lifeline does not measure or monitor heart rate, blood oxygen, blood pressure,
glucose, or other physiological readings. The previous experimental Bluetooth
vital-reading path has been removed. The app has no supported wearable vital
integration and must not be used to make a health decision based on a reading.

## Phone motion sensor

The movement monitor can request the phone browser's `devicemotion` stream. On
supported devices it evaluates motion for a possible fall-like jolt and extended
stillness. These signals are not medical-grade fall detection and cannot
establish that a person fell, is injured, or needs help.

To use it, open Lifeline over HTTPS in a browser that exposes the device motion
API, press **Start monitoring**, grant motion permission if prompted, and keep
the page open and in the foreground on the phone producing the sensor readings.
Keep the phone on your person; a phone left on a table measures the table. The
interface reports unsupported hardware, denied permission, missing or stale
sensor data, and a backgrounded tab as unavailable. It does not treat a quiet
sensor stream as proof that the person is still.

### Background and device limits

- A web page cannot keep this monitor running after the tab is closed or while
  the browser suspends it in the background. The monitor pauses when the page is
  hidden and reports when it is unavailable.
- Lifeline has no Android foreground service, native iOS service, Bluetooth
  sensor integration, or external wearable support.
- Browser permission and sensor availability vary by device, operating system,
  and browser. The exact hardware and permission flow must be checked on each
  target device.
- A detected event opens Lifeline's alarm and cancellation flow. Contact calls
  or messages depend on the user's saved settings, consent, network, configured
  provider, and platform support. The web app cannot guarantee delivery or
  emergency response.

## Verification status

The movement classifier and browser availability states have automated tests.
Synthetic test traces never open an alarm or contact a provider. Real sensor
behaviour, false-positive rates, background suspension, battery use, and the
alarm-to-contact workflow still require physical-device testing. Thresholds are
engineering defaults, not clinically calibrated values.

For an urgent situation, use the phone's emergency calling feature or local
emergency number directly. Do not wait for Lifeline or an AI response.
