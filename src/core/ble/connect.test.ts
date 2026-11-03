import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { appStore, set } from "@/lib/store";
import { pairWearable, disconnectWearable } from "./connect";
class Characteristic extends EventTarget {
  value?: DataView;
  properties?: { notify?: boolean; indicate?: boolean; read?: boolean };
  readValue?: () => Promise<Characteristic>;
  startNotifications = vi.fn(async () => this);
  emit(bytes: number[]) {
    this.value = new DataView(new Uint8Array(bytes).buffer);
    this.dispatchEvent(new Event("characteristicvaluechanged"));
  }
}
function fakeDevice(compatible = true) {
  const ch = new Characteristic();
  const device = Object.assign(new EventTarget(), {
    name: "Synthetic heart-rate fixture",
    id: "synthetic-only",
    gatt: { connected: false, connect: vi.fn(), disconnect: vi.fn() },
  });
  const server = {
    connected: true,
    getPrimaryService: vi.fn(async (uuid: number) => {
      if (!compatible || uuid !== 0x180d) throw new Error("Service absent");
      return { getCharacteristic: async () => ch };
    }),
  };
  device.gatt.connect.mockImplementation(async () => server);
  return { device, ch, server };
}
const requestDevice = vi.fn();
beforeEach(() => {
  disconnectWearable();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "bluetooth", { configurable: true, value: { requestDevice } });
  requestDevice.mockReset();
  set({ demoMode: false, vitals: {}, device: { status: "idle", name: null, vitals: [] } });
});
afterEach(() => {
  disconnectWearable();
  vi.useRealTimers();
});
describe("Bluetooth adapter with synthetic EventTarget devices — no physical hardware", () => {
  it("does not open chooser until explicitly called; connects without fabricating measurements", async () => {
    const { device } = fakeDevice();
    requestDevice.mockResolvedValue(device);
    expect(requestDevice).not.toHaveBeenCalled();
    await pairWearable();
    expect(appStore.state.device.status).toBe("connected");
    expect(appStore.state.device.vitals).toEqual(["hr"]);
    expect(appStore.state.vitals).toEqual({});
  });
  it("reports the connecting stage separately from chooser opening", async () => {
    const { device } = fakeDevice();
    let finish!: (s: unknown) => void;
    device.gatt.connect.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    requestDevice.mockResolvedValue(device);
    const pair = pairWearable();
    await Promise.resolve();
    expect(appStore.state.device.status).toBe("connecting");
    disconnectWearable();
    finish({ connected: true });
    await pair;
    expect(appStore.state.device.status).toBe("idle");
  });
  it.each(["NotFoundError", "NotAllowedError", "NetworkError"])(
    "does not turn %s into a successful connection",
    async (name) => {
      requestDevice.mockRejectedValue(
        Object.assign(new Error("Synthetic chooser result"), { name }),
      );
      await expect(pairWearable()).rejects.toHaveProperty("name", name);
      expect(appStore.state.device.status).toBe(name === "NotFoundError" ? "idle" : "error");
      expect(appStore.state.vitals).toEqual({});
    },
  );
  it("reports a connected device with no supported service as unsupported, not as connected", async () => {
    const { device } = fakeDevice(false);
    requestDevice.mockResolvedValue(device);
    await expect(pairWearable()).rejects.toHaveProperty("name", "UnsupportedServicesError");
    expect(device.gatt.disconnect).toHaveBeenCalled();
    expect(appStore.state.device.status).toBe("error");
    expect(appStore.state.device.error).toBe("unsupported-services");
    expect(appStore.state.vitals).toEqual({});
  });

  it("can list every nearby device while still only reading the standard services", async () => {
    const { device } = fakeDevice();
    requestDevice.mockResolvedValue(device);
    await pairWearable("any");
    expect(requestDevice).toHaveBeenCalledWith({
      acceptAllDevices: true,
      optionalServices: [0x180d, 0x1822, 0x1810, 0x1808],
    });
    expect(appStore.state.device.mode).toBe("any");
    expect(appStore.state.device.vitals).toEqual(["hr"]);
  });

  it("reads a characteristic that only supports read instead of calling it incompatible", async () => {
    const ch = new Characteristic();
    ch.properties = { read: true };
    ch.readValue = vi.fn(async () => {
      ch.value = new DataView(new Uint8Array([0, 66]).buffer);
      return ch;
    });
    const device = Object.assign(new EventTarget(), {
      name: "Synthetic read-only cuff",
      id: "synthetic-read-only",
      gatt: { connected: false, connect: vi.fn(), disconnect: vi.fn() },
    });
    const server = {
      connected: true,
      getPrimaryService: vi.fn(async (uuid: number) => {
        if (uuid !== 0x180d) throw new Error("Service absent");
        return { getCharacteristic: async () => ch };
      }),
    };
    device.gatt.connect.mockImplementation(async () => server);
    requestDevice.mockResolvedValue(device);

    await pairWearable();
    expect(appStore.state.device.vitals).toEqual(["hr"]);
    expect(ch.startNotifications).not.toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appStore.state.vitals.hr?.value).toBe(66);
  });

  it("subscribes to the spot-check oximetry characteristic used by finger oximeters", async () => {
    const ch = new Characteristic();
    const device = Object.assign(new EventTarget(), {
      name: "Synthetic spot-check oximeter",
      id: "synthetic-spot-check",
      gatt: { connected: false, connect: vi.fn(), disconnect: vi.fn() },
    });
    const server = {
      connected: true,
      getPrimaryService: vi.fn(async (uuid: number) => {
        if (uuid !== 0x1822) throw new Error("Service absent");
        return {
          getCharacteristic: async (char: number) => {
            if (char !== 0x2a5e) throw new Error("Characteristic absent");
            return ch;
          },
        };
      }),
    };
    device.gatt.connect.mockImplementation(async () => server);
    requestDevice.mockResolvedValue(device);

    await pairWearable();
    expect(appStore.state.device.vitals).toEqual(["spo2"]);
    ch.emit([0, 98, 0, 64, 0]);
    expect(appStore.state.vitals.spo2).toMatchObject({ value: 98, unit: "%" });
  });

  it("reads the current value once when notifications are also offered", async () => {
    const { device, ch } = fakeDevice();
    ch.properties = { notify: true, read: true };
    ch.readValue = vi.fn(async () => {
      ch.value = new DataView(new Uint8Array([0, 81]).buffer);
      return ch;
    });
    requestDevice.mockResolvedValue(device);

    await pairWearable();
    expect(ch.startNotifications).toHaveBeenCalledTimes(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(appStore.state.vitals.hr?.value).toBe(81);
  });

  it("records when a measurement arrived and how many were accepted", async () => {
    const { device, ch } = fakeDevice();
    requestDevice.mockResolvedValue(device);
    await pairWearable();
    expect(appStore.state.device.connectedAt).toBeTypeOf("number");
    ch.emit([0, 70]);
    expect(appStore.state.device.lastReadingAt).toBeTypeOf("number");
    expect(appStore.state.device.readingCount).toBe(1);
    expect(appStore.state.device.servicesFound).toEqual(["hr"]);
    expect(appStore.state.device.missing).toEqual(["spo2", "bp", "glucose"]);
  });

  it("rejects a physiologically impossible value instead of displaying it", async () => {
    const { device, ch } = fakeDevice();
    requestDevice.mockResolvedValue(device);
    await pairWearable();
    ch.emit([0, 3]); // 3 beats/min is a mis-scaled packet, not a reading
    expect(appStore.state.vitals.hr).toBeUndefined();
    expect(appStore.state.device.error).toBe("invalid-reading");
  });
  it("accepts valid packet data as unverified, rejects malformed or no-contact data", async () => {
    const { device, ch } = fakeDevice();
    requestDevice.mockResolvedValue(device);
    await pairWearable();
    ch.emit([0, 72]);
    expect(appStore.state.vitals.hr?.value).toBe(72);
    expect(appStore.state.vitals.hr?.quality).toBe("uncertain");
    ch.emit([0]);
    expect(appStore.state.vitals.hr).toBeUndefined();
    expect(appStore.state.device.error).toBe("invalid-reading");
    ch.emit([4, 72]);
    expect(appStore.state.vitals.hr).toBeUndefined();
  });
  it("clears readings on loss and never starts automatic reconnect", async () => {
    const { device, ch } = fakeDevice();
    requestDevice.mockResolvedValue(device);
    await pairWearable();
    ch.emit([0, 74]);
    device.dispatchEvent(new Event("gattserverdisconnected"));
    expect(appStore.state.device.status).toBe("disconnected");
    expect(appStore.state.vitals).toEqual({});
    expect(device.gatt.connect).toHaveBeenCalledTimes(1);
    ch.emit([0, 90]);
    expect(appStore.state.vitals).toEqual({});
  });
  it("removes the previous device listeners on a later pairing", async () => {
    const one = fakeDevice(),
      two = fakeDevice();
    requestDevice.mockResolvedValueOnce(one.device).mockResolvedValueOnce(two.device);
    await pairWearable();
    await pairWearable();
    one.ch.emit([0, 200]);
    one.device.dispatchEvent(new Event("gattserverdisconnected"));
    expect(appStore.state.vitals.hr).toBeUndefined();
    expect(appStore.state.device.status).toBe("connected");
    two.ch.emit([0, 78]);
    expect(appStore.state.vitals.hr?.value).toBe(78);
  });
  it("rejects insecure pages before opening any chooser", async () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    await expect(pairWearable()).rejects.toHaveProperty("name", "SecurityError");
    expect(requestDevice).not.toHaveBeenCalled();
  });
  it("handles missing browser support before opening any chooser", async () => {
    Reflect.deleteProperty(navigator, "bluetooth");
    await expect(pairWearable()).rejects.toHaveProperty("name", "NotSupportedError");
    expect(requestDevice).not.toHaveBeenCalled();
  });
});
