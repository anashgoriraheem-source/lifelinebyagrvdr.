/** Foreground, user-initiated standard-service adapter. No hardware verified.
 * Reconnection requires a new deliberate action. Session guards prevent old
 * devices/notifications from overwriting a newer connection or demo session.
 */
import { addLog, set } from "@/lib/store";
import type { Reading, VitalKey } from "@/lib/types";
import {
  parseBloodPressureMeasurement,
  parseGlucoseMeasurement,
  parseHeartRateMeasurement,
  parsePulseOxMeasurement,
} from "./parsers";
type Char = EventTarget & { value?: DataView; startNotifications(): Promise<Char> };
type Server = {
  getPrimaryService(uuid: number): Promise<{ getCharacteristic(uuid: number): Promise<Char> }>;
  connected: boolean;
};
type Device = EventTarget & {
  name?: string;
  id: string;
  gatt?: { connect(): Promise<Server>; disconnect(): void; connected: boolean };
};
const SERVICES: {
  service: number;
  char: number;
  key: VitalKey;
  parse: (d: Uint8Array) => Partial<Reading>;
}[] = [
  {
    service: 0x180d,
    char: 0x2a37,
    key: "hr",
    parse: (d) => {
      const r = parseHeartRateMeasurement(d);
      if (d[0] & 4 && !r.contactDetected) throw new Error("No sensor contact");
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
      return { value: r.systolic, value2: r.diastolic, unit: "mmHg" };
    },
  },
  {
    service: 0x1808,
    char: 0x2a18,
    key: "glucose",
    parse: (d) => ({ value: parseGlucoseMeasurement(d).value, unit: "mg/dL" }),
  },
];
let device: Device | null = null;
let generation = 0;
let pairing = false;
let cleanups: (() => void)[] = [];
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
  old?.gatt?.disconnect();
}
export async function pairWearable() {
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
    const selected = await bt.requestDevice({
      filters: SERVICES.map((s) => ({ services: [s.service] })),
      optionalServices: SERVICES.map((s) => s.service),
    });
    if (session !== generation) return;
    device = selected;
    set({
      demoMode: false,
      scenario: "stable",
      vitals: {},
      history: { hr: [], spo2: [], bp: [], glucose: [] },
      device: { status: "connecting", name: selected.name ?? null, vitals: [] },
    });
    const lost = () => {
      if (session !== generation) return;
      ++generation;
      release();
      set({
        device: { status: "disconnected", name: selected.name ?? null, vitals: [] },
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
      let ch: Char | undefined, handler: EventListener | undefined;
      try {
        const service = await server.getPrimaryService(s.service);
        ch = await service.getCharacteristic(s.char);
        if (session !== generation) return;
        const characteristic = ch;
        handler = () => {
          if (session !== generation || !characteristic.value) return;
          try {
            const v = characteristic.value;
            const r = s.parse(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
            if (r.value == null || !Number.isFinite(r.value) || r.value <= 0)
              throw new Error("Invalid reading");
            const now = Date.now();
            // Received time is used; device clock/history provenance is unverified.
            const reading: Reading = {
              value: r.value,
              value2: r.value2,
              unit: r.unit ?? "",
              source: selected.name ?? "Bluetooth device",
              measuredAt: now,
              receivedAt: now,
              quality: "uncertain",
            };
            set((state) => ({
              vitals: { ...state.vitals, [s.key]: reading },
              history: {
                ...state.history,
                [s.key]: [...state.history[s.key], reading.value].slice(-60),
              },
              device: { ...state.device, error: undefined },
            }));
          } catch {
            set((state) => {
              const vitals = { ...state.vitals };
              delete vitals[s.key];
              return { vitals, device: { ...state.device, error: "invalid-reading" } };
            });
          }
        };
        characteristic.addEventListener("characteristicvaluechanged", handler);
        await characteristic.startNotifications();
        if (session !== generation) {
          characteristic.removeEventListener("characteristicvaluechanged", handler);
          return;
        }
        const listener = handler;
        cleanups.push(() =>
          characteristic.removeEventListener("characteristicvaluechanged", listener),
        );
        found.push(s.key);
      } catch {
        if (ch && handler) ch.removeEventListener("characteristicvaluechanged", handler);
      }
    }
    if (session !== generation) return;
    if (!found.length)
      throw namedError("IncompatibleDeviceError", "No supported measurement notifications");
    set({ device: { status: "connected", name: selected.name ?? null, vitals: found } });
    addLog("device", "Device connected. A connection is not a measurement.");
  } catch (error) {
    if (session === generation) {
      release();
      const name = (error as Error)?.name;
      set({
        device: {
          status: name === "NotFoundError" ? "idle" : "error",
          name: null,
          vitals: [],
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
export function disconnectWearable() {
  ++generation;
  release();
  set({ device: { status: "idle", name: null, vitals: [] }, vitals: {} });
  addLog("device", "Device disconnected. No readings are being received.");
}
