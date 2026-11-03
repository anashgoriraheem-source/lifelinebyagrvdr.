/** Foreground, user-initiated standard-service adapter. No hardware verified.
 *
 * Discovery has two deliberate modes:
 *  - `standard` uses a service filter, so the browser only lists devices that
 *    advertise one of the four supported health services;
 *  - `any` lists every nearby device (Web Bluetooth `acceptAllDevices`) and
 *    then inspects the standard services. A watch that keeps its data behind a
 *    vendor service can be selected and is reported as unsupported instead of
 *    silently missing from the chooser.
 *
 * Notifications are preferred, plus one read of the current value when the
 * characteristic allows it (a stored measurement then appears at once). A
 * characteristic that is only readable is polled instead of being reported as
 * incompatible. Pulse oximeters may expose either the continuous (0x2a5f) or
 * the spot-check (0x2a5e) characteristic; each vital is subscribed once.
 * A GATT connection is never treated as monitoring: only parsed, plausible
 * packets become readings.
 *
 * A drop is recovered by the adapter itself while this page stays open: at most
 * three attempts with a growing delay, and never a fourth (the browser may also
 * refuse, in which case the attempt fails and the person is asked to reconnect
 * by hand). A disconnect the person asked for cancels all of that immediately,
 * and one connection attempt is ever in flight.
 *
 * Session guards prevent old devices/notifications from overwriting a newer
 * connection or demo session.
 */
import { addLog, appStore, set } from "@/lib/store";
import type { DeviceIssue, Reading, VitalKey } from "@/lib/types";
import {
  parseBloodPressureMeasurement,
  parseGlucoseMeasurement,
  parseHeartRateMeasurement,
  parsePulseOxMeasurement,
  parsePulseOxSpotCheck,
} from "./parsers";
import { missingServices, plausibleReading, validMeasurementTime } from "./support";

type Char = EventTarget & {
  value?: DataView;
  properties?: { notify?: boolean; indicate?: boolean; read?: boolean };
  startNotifications(): Promise<Char>;
  stopNotifications?(): Promise<Char>;
  readValue?(): Promise<Char>;
};
type Service = { getCharacteristic(uuid: number): Promise<Char> };
type Server = {
  getPrimaryService(uuid: number): Promise<Service>;
  connected: boolean;
};
type Device = EventTarget & {
  name?: string;
  id: string;
  gatt?: { connect(): Promise<Server>; disconnect(): void; connected: boolean };
};
type Parsed = Partial<Reading> & { measuredAt?: number };

const SERVICES: {
  service: number;
  char: number;
  key: VitalKey;
  parse: (d: Uint8Array) => Parsed;
}[] = [
  {
    service: 0x180d,
    char: 0x2a37,
    key: "hr",
    parse: (d) => {
      const r = parseHeartRateMeasurement(d);
      // Bit 2 says the device supports contact detection; without contact the
      // value is not a usable heart rate.
      if (d[0] & 4 && !r.contactDetected)
        throw Object.assign(new Error("No sensor contact"), { name: "NoContactError" });
      return { value: r.value, unit: "bpm" };
    },
  },
  {
    service: 0x1822,
    char: 0x2a5f,
    key: "spo2",
    parse: (d) => ({ value: Math.round(parsePulseOxMeasurement(d).value), unit: "%" }),
  },
  {
    // Many finger oximeters only expose the one-shot spot-check characteristic.
    service: 0x1822,
    char: 0x2a5e,
    key: "spo2",
    parse: (d) => ({ value: Math.round(parsePulseOxSpotCheck(d).value), unit: "%" }),
  },
  {
    service: 0x1810,
    char: 0x2a35,
    key: "bp",
    parse: (d) => {
      const r = parseBloodPressureMeasurement(d);
      return { value: r.systolic, value2: r.diastolic, unit: "mmHg", measuredAt: r.measuredAt };
    },
  },
  {
    service: 0x1808,
    char: 0x2a18,
    key: "glucose",
    parse: (d) => ({ value: parseGlucoseMeasurement(d).value, unit: "mg/dL" }),
  },
];

/** How often a readable-only characteristic is re-read. */
const READ_POLL_MS = 5_000;

/** Automatic recovery stays bounded: three attempts, then the person decides. */
export const MAX_RECOVERY_ATTEMPTS = 3;
/** Wait before attempt 1, 2 and 3. Growing, so a device that is off is not hammered. */
export const RECOVERY_BACKOFF_MS = [1_500, 4_000, 9_000];

const deviceName = (selected: Device) => selected.name ?? "Bluetooth device";

let device: Device | null = null;
/** Kept after a loss so "Connect again" can reuse the grant without the chooser. */
let lastDevice: Device | null = null;
/** How the current/last device was discovered, so a retry reports the same mode. */
let lastMode: PairMode = "standard";
let generation = 0;
let pairing = false;
let cleanups: (() => void)[] = [];

let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
let recoveryAttempts = 0;
let recovering = false;
/** Set by an explicit disconnect. It stops every pending and future retry. */
let stoppedByUser = false;

export type PairMode = "standard" | "any";

type Subscription =
  | { ok: true; transport: "notify" | "read" }
  | { ok: false; reason: "service-missing" | DeviceIssue["reason"] };

const clearListeners = () => {
  cleanups.forEach((f) => f());
  cleanups = [];
};
export const bluetoothSupported = () =>
  typeof navigator !== "undefined" && "bluetooth" in navigator;
const namedError = (name: string, message: string) => Object.assign(new Error(message), { name });

function release() {
  clearListeners();
  const old = device;
  device = null;
  try {
    old?.gatt?.disconnect();
  } catch {
    /* already gone */
  }
}

/** Stops any pending or running automatic recovery. */
function cancelRecovery() {
  if (recoveryTimer != null) clearTimeout(recoveryTimer);
  recoveryTimer = null;
  recovering = false;
  recoveryAttempts = 0;
}

function publishRecoveryAttempt(attempt: number | null) {
  set((state) => ({ device: { ...state.device, recoveryAttempt: attempt } }));
}

function applyMeasurement(
  s: (typeof SERVICES)[number],
  view: DataView,
  session: number,
  name: string,
) {
  if (session !== generation) return;
  try {
    const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
    const parsed = s.parse(bytes);
    if (parsed.value == null || !plausibleReading(s.key, parsed.value, parsed.value2))
      throw namedError("InvalidReadingError", "Invalid or implausible reading");
    const now = Date.now();
    const measuredAt =
      parsed.measuredAt != null && validMeasurementTime(parsed.measuredAt, now)
        ? parsed.measuredAt
        : now;
    const reading: Reading = {
      value: parsed.value,
      value2: parsed.value2,
      unit: parsed.unit ?? "",
      source: name,
      measuredAt,
      receivedAt: now,
      // A standard packet is still an unverified measurement: it is shown with
      // its timestamp and is never used for automatic threshold alarms.
      quality: "uncertain",
    };
    set((state) => ({
      vitals: { ...state.vitals, [s.key]: reading },
      history: {
        ...state.history,
        [s.key]: [...state.history[s.key], reading.value].slice(-60),
      },
      device: {
        ...state.device,
        error: undefined,
        lastReadingAt: now,
        readingCount: (state.device.readingCount ?? 0) + 1,
      },
    }));
  } catch (error) {
    const code = (error as Error)?.name === "NoContactError" ? "no-contact" : "invalid-reading";
    set((state) => {
      const vitals = { ...state.vitals };
      delete vitals[s.key];
      return {
        vitals,
        device: { ...state.device, error: code, lastInvalidAt: Date.now() },
      };
    });
  }
}

/**
 * Subscribes to one standard service. Notifications are used when offered; a
 * readable-only characteristic is polled. A failure is reported back so the
 * device page can say which reading did not start, instead of looking connected
 * and silent for no stated reason.
 */
async function subscribe(
  server: Server,
  s: (typeof SERVICES)[number],
  session: number,
  name: string,
): Promise<Subscription> {
  let service: Service;
  try {
    service = await server.getPrimaryService(s.service);
  } catch {
    return { ok: false, reason: "service-missing" };
  }
  if (session !== generation) return { ok: false, reason: "service-missing" };

  let characteristic: Char;
  try {
    characteristic = await service.getCharacteristic(s.char);
  } catch {
    return { ok: false, reason: "characteristic-missing" };
  }
  if (session !== generation) return { ok: false, reason: "service-missing" };

  const onValue = () => {
    if (characteristic.value) applyMeasurement(s, characteristic.value, session, name);
  };
  const wantsNotifications =
    characteristic.properties == null ||
    Boolean(characteristic.properties.notify || characteristic.properties.indicate);

  if (wantsNotifications) {
    characteristic.addEventListener("characteristicvaluechanged", onValue);
    try {
      await characteristic.startNotifications();
      if (session !== generation) {
        characteristic.removeEventListener("characteristicvaluechanged", onValue);
        return { ok: false, reason: "service-missing" };
      }
      cleanups.push(() => {
        characteristic.removeEventListener("characteristicvaluechanged", onValue);
        // Stop the stream as well as the listener: a device that is switched to
        // another connection should not keep pushing into this page.
        void characteristic.stopNotifications?.().catch(() => {
          /* The link is usually already gone; nothing left to stop. */
        });
      });
      // A device that also allows reads usually holds its latest measurement.
      // Reading it once means a stored value shows up immediately instead of
      // waiting for the device to push the next one.
      if (characteristic.properties?.read && characteristic.readValue) {
        void characteristic
          .readValue()
          .then((fresh) => {
            if (fresh?.value && session === generation) {
              applyMeasurement(s, fresh.value, session, name);
            }
          })
          .catch(() => {
            /* The notification stream is still the primary path. */
          });
      }
      return { ok: true, transport: "notify" };
    } catch {
      characteristic.removeEventListener("characteristicvaluechanged", onValue);
      if (!characteristic.readValue) return { ok: false, reason: "notifications-failed" };
    }
  }

  // Read-only fallback: one immediate read, then a slow poll while connected.
  const readValue = characteristic.readValue;
  if (!readValue) return { ok: false, reason: "notifications-failed" };
  let stopped = false;
  const poll = async () => {
    if (stopped || session !== generation) return;
    try {
      const fresh = await readValue.call(characteristic);
      if (fresh?.value) applyMeasurement(s, fresh.value, session, name);
    } catch {
      /* A failed read is reported by the connection state, not as a reading. */
    }
  };
  void poll();
  const id = setInterval(poll, READ_POLL_MS);
  cleanups.push(() => {
    stopped = true;
    clearInterval(id);
  });
  return { ok: true, transport: "read" };
}

async function startConnection(
  selected: Device,
  session: number,
  mode: PairMode,
  options: { auto?: boolean } = {},
) {
  const automatic = options.auto === true;
  const name = deviceName(selected);
  device = selected;
  lastDevice = selected;
  lastMode = mode;
  set({
    demoMode: false,
    scenario: "stable",
    vitals: {},
    history: { hr: [], spo2: [], bp: [], glucose: [] },
    device: {
      status: automatic ? "reconnecting" : "connecting",
      name: selected.name ?? null,
      vitals: [],
      mode,
      connectedAt: null,
      lastReadingAt: null,
      readingCount: 0,
      error: undefined,
      issues: [],
      recoveryAttempt: automatic ? recoveryAttempts : null,
    },
  });

  const lost = () => {
    if (session !== generation) return;
    ++generation;
    release();
    set({
      device: {
        status: "disconnected",
        name: selected.name ?? null,
        vitals: [],
        mode,
        connectedAt: null,
        recoveryAttempt: null,
      },
      vitals: {},
    });
    if (stoppedByUser) {
      addLog("device", "Device disconnected. No readings are being received.");
      return;
    }
    addLog("device", "Connection lost. Lifeline is trying to reconnect.");
    scheduleRecovery();
  };
  selected.addEventListener("gattserverdisconnected", lost);
  cleanups.push(() => selected.removeEventListener("gattserverdisconnected", lost));

  if (!selected.gatt) throw namedError("IncompatibleDeviceError", "No supported data connection");
  const server = await selected.gatt.connect();
  if (session !== generation) {
    selected.gatt.disconnect();
    return;
  }

  const found: VitalKey[] = [];
  const issues: DeviceIssue[] = [];
  for (const s of SERVICES) {
    // One subscription per vital: a device offering both pulse-oximetry
    // characteristics is read once, through the first one that works.
    if (found.includes(s.key)) continue;
    const result = await subscribe(server, s, session, name);
    if (session !== generation) return;
    if (result.ok) found.push(s.key);
    // "service-missing" is the ordinary case: this device simply does not offer
    // that measurement. Only a service it does offer but cannot stream is worth
    // telling the person about.
    else if (result.reason !== "service-missing")
      issues.push({ key: s.key, reason: result.reason });
  }
  if (session !== generation) return;

  if (!found.length) {
    release();
    // Connected over GATT but nothing we can read: a distinct, explainable state.
    set({
      device: {
        status: "error",
        name: selected.name ?? null,
        vitals: [],
        mode,
        connectedAt: null,
        error: "unsupported-services",
        issues,
        recoveryAttempt: null,
      },
      vitals: {},
    });
    throw namedError(
      "UnsupportedServicesError",
      "Connected, but the device exposes no supported measurement service",
    );
  }

  set((state) => ({
    device: {
      ...state.device,
      status: "connected",
      name: selected.name ?? null,
      vitals: found,
      servicesFound: found,
      missing: missingServices(found),
      mode,
      connectedAt: Date.now(),
      error: undefined,
      issues,
      recoveryAttempt: null,
    },
  }));
  addLog(
    "device",
    issues.length
      ? `Device connected · ${found.join(", ")} subscribed. ${issues
          .map((i) => i.key)
          .join(", ")} would not start. A connection is not a measurement.`
      : `Device connected · ${found.join(", ")} subscribed. A connection is not a measurement.`,
  );
}

/**
 * Retries the last granted device without the chooser. Bounded, sequential and
 * cancellable: `disconnectWearable` ends it, and a retry never starts while one
 * is already running.
 */
function scheduleRecovery() {
  if (stoppedByUser || recovering || recoveryTimer != null) return;
  if (!lastDevice?.gatt) return;
  if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
    set((state) => ({
      device: { ...state.device, status: "disconnected", error: "recovery-stopped" },
    }));
    addLog(
      "device",
      "Stopped trying to reconnect. Open the device list again when the device is nearby.",
    );
    return;
  }
  const delay =
    RECOVERY_BACKOFF_MS[Math.min(recoveryAttempts, RECOVERY_BACKOFF_MS.length - 1)] ??
    RECOVERY_BACKOFF_MS[0];
  recoveryTimer = setTimeout(() => {
    recoveryTimer = null;
    void attemptRecovery();
  }, delay);
}

async function attemptRecovery() {
  if (stoppedByUser || pairing) return;
  const target = lastDevice;
  if (!target?.gatt) return;
  recovering = true;
  recoveryAttempts += 1;
  publishRecoveryAttempt(recoveryAttempts);
  const session = ++generation;
  release();
  try {
    await startConnection(target, session, lastMode, { auto: true });
    recoveryAttempts = 0;
  } catch (error) {
    const name = (error as Error)?.name;
    if (name === "UnsupportedServicesError") {
      // A precise, non-transient state: the device connected but has nothing for
      // us. Retrying would produce the same answer.
      cancelRecovery();
      return;
    }
    if (session === generation) {
      release();
      set({
        device: {
          status: "disconnected",
          name: target.name ?? null,
          vitals: [],
          mode: lastMode,
          connectedAt: null,
          recoveryAttempt: null,
        },
        vitals: {},
      });
    }
  } finally {
    recovering = false;
  }
  if (!stoppedByUser && appStore.state.device.status !== "connected") scheduleRecovery();
}

// Coming back to the page is the usual moment a phone has dropped the link
// (the browser suspends Bluetooth while the tab is in the background).
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (stoppedByUser || !lastDevice) return;
    const { status } = appStore.state.device;
    if (status === "disconnected" || status === "error") {
      recoveryAttempts = 0;
      scheduleRecovery();
    }
  });
}

export async function pairWearable(mode: PairMode = "standard") {
  if (pairing) return;
  if (typeof window !== "undefined" && !window.isSecureContext)
    throw namedError("SecurityError", "Secure page required");
  if (!bluetoothSupported()) throw namedError("NotSupportedError", "Bluetooth is not available");
  // A deliberate action always wins over an automatic retry.
  stoppedByUser = false;
  cancelRecovery();
  pairing = true;
  const session = ++generation;
  release();
  set({ device: { status: "idle", name: null, vitals: [] }, vitals: {} });
  try {
    // requestDevice must remain directly within the trusted click's task.
    const bt = (
      navigator as unknown as { bluetooth: { requestDevice(o: unknown): Promise<Device> } }
    ).bluetooth;
    // Two pulse-oximetry characteristics share one service, so the UUID list is
    // de-duplicated before it reaches the browser chooser.
    const serviceIds = [...new Set(SERVICES.map((s) => s.service))];
    const optionalServices = serviceIds;
    const selected = await bt.requestDevice(
      mode === "any"
        ? { acceptAllDevices: true, optionalServices }
        : {
            filters: serviceIds.map((service) => ({ services: [service] })),
            optionalServices,
          },
    );
    if (session !== generation) return;
    await startConnection(selected, session, mode);
  } catch (error) {
    const name = (error as Error)?.name;
    if (session === generation && name === "UnsupportedServicesError") {
      // startConnection already published the precise connected-but-unsupported
      // state (device name and error code), so keep it instead of overwriting.
      addLog("device", "Device connected but offered no supported measurement service.");
    } else if (session === generation) {
      release();
      set({
        device: {
          status: name === "NotFoundError" ? "idle" : "error",
          name: null,
          vitals: [],
          mode,
          error: name,
        },
        vitals: {},
      });
    }
    throw error;
  } finally {
    pairing = false;
  }
}

/**
 * Reuses the device the browser already granted us (no new chooser) after a
 * dropped connection. Falls back to an explicit error when the grant is gone
 * so the caller can offer the chooser again.
 */
export async function reconnectWearable() {
  if (pairing) return;
  const target = lastDevice;
  if (!target?.gatt) throw namedError("NotFoundError", "No previous device to reconnect");
  if (typeof window !== "undefined" && !window.isSecureContext)
    throw namedError("SecurityError", "Secure page required");
  if (!bluetoothSupported()) throw namedError("NotSupportedError", "Bluetooth is not available");
  stoppedByUser = false;
  cancelRecovery();
  pairing = true;
  const session = ++generation;
  // Drop the previous GATT link (and its listeners) before reconnecting, so a
  // retry from a still-connected-but-silent device never leaves two links open.
  release();
  try {
    await startConnection(target, session, lastMode);
  } catch (error) {
    if (session === generation) {
      release();
      const name = (error as Error)?.name;
      set({
        device: {
          status: "error",
          name: target.name ?? null,
          vitals: [],
          error: name === "UnsupportedServicesError" ? name : "reconnect-failed",
        },
        vitals: {},
      });
    }
    throw error;
  } finally {
    pairing = false;
  }
}

export function disconnectWearable() {
  stoppedByUser = true;
  cancelRecovery();
  ++generation;
  release();
  lastDevice = null;
  set({ device: { status: "idle", name: null, vitals: [] }, vitals: {} });
  addLog("device", "Device disconnected. No readings are being received.");
}
