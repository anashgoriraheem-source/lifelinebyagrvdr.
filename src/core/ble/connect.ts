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
 * Notifications are preferred; a characteristic that is only readable is polled
 * instead of being reported as incompatible. A GATT connection is never treated
 * as monitoring: only parsed, plausible packets become readings.
 *
 * Reconnection requires a new deliberate action (the button, not a timer).
 * Session guards prevent old devices/notifications from overwriting a newer
 * connection or demo session.
 */
import { addLog, set } from "@/lib/store";
import type { Reading, VitalKey } from "@/lib/types";
import {
  parseBloodPressureMeasurement,
  parseGlucoseMeasurement,
  parseHeartRateMeasurement,
  parsePulseOxMeasurement,
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

let device: Device | null = null;
/** Kept after a loss so "Connect again" can reuse the grant without the chooser. */
let lastDevice: Device | null = null;
let generation = 0;
let pairing = false;
let cleanups: (() => void)[] = [];

export type PairMode = "standard" | "any";

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
 * readable-only characteristic is polled. Returns how readings arrive, or null
 * when the device has nothing usable for this service.
 */
async function subscribe(
  server: Server,
  s: (typeof SERVICES)[number],
  session: number,
  name: string,
): Promise<"notify" | "read" | null> {
  const service = await server.getPrimaryService(s.service);
  const characteristic = await service.getCharacteristic(s.char);
  if (session !== generation) return null;

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
        return null;
      }
      cleanups.push(() =>
        characteristic.removeEventListener("characteristicvaluechanged", onValue),
      );
      return "notify";
    } catch {
      characteristic.removeEventListener("characteristicvaluechanged", onValue);
      if (!characteristic.readValue) return null;
    }
  }

  // Read-only fallback: one immediate read, then a slow poll while connected.
  const readValue = characteristic.readValue;
  if (!readValue) return null;
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
  return "read";
}

async function startConnection(selected: Device, session: number, mode: PairMode) {
  device = selected;
  lastDevice = selected;
  const name = selected.name ?? "Bluetooth device";
  set({
    demoMode: false,
    scenario: "stable",
    vitals: {},
    history: { hr: [], spo2: [], bp: [], glucose: [] },
    device: {
      status: "connecting",
      name: selected.name ?? null,
      vitals: [],
      mode,
      connectedAt: null,
      lastReadingAt: null,
      readingCount: 0,
      error: undefined,
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
      },
      vitals: {},
    });
    addLog("device", "Connection lost. Keep the device nearby and connect again.");
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
  for (const s of SERVICES) {
    try {
      const transport = await subscribe(server, s, session, name);
      if (session !== generation) return;
      if (transport) found.push(s.key);
    } catch {
      /* Service or characteristic absent — this device simply does not offer it. */
    }
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
    },
  }));
  addLog(
    "device",
    `Device connected · ${found.join(", ")} subscribed. A connection is not a measurement.`,
  );
}

export async function pairWearable(mode: PairMode = "standard") {
  if (pairing) return;
  if (typeof window !== "undefined" && !window.isSecureContext)
    throw namedError("SecurityError", "Secure page required");
  if (!bluetoothSupported()) throw namedError("NotSupportedError", "Bluetooth is not available");
  pairing = true;
  const session = ++generation;
  release();
  set({ device: { status: "idle", name: null, vitals: [] }, vitals: {} });
  try {
    // requestDevice must remain directly within the trusted click's task.
    const bt = (
      navigator as unknown as { bluetooth: { requestDevice(o: unknown): Promise<Device> } }
    ).bluetooth;
    const optionalServices = SERVICES.map((s) => s.service);
    const selected = await bt.requestDevice(
      mode === "any"
        ? { acceptAllDevices: true, optionalServices }
        : {
            filters: SERVICES.map((s) => ({ services: [s.service] })),
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
  pairing = true;
  const session = ++generation;
  clearListeners();
  try {
    await startConnection(target, session, "standard");
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
  ++generation;
  release();
  lastDevice = null;
  set({ device: { status: "idle", name: null, vitals: [] }, vitals: {} });
  addLog("device", "Device disconnected. No readings are being received.");
}
