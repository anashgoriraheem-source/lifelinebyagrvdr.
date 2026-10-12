/**
 * Web Bluetooth pairing for standard health wearables (heart rate, pulse
 * oximeter, blood pressure, glucose). Readings are pushed into the app store;
 * the VitalsEngine runs detection on them and raises real alarms.
 * Works in Chrome/Edge on Android, Windows, macOS and ChromeOS (not iOS Safari).
 */
import { appStore, addLog, set } from '@/lib/store'
import type { Reading, VitalKey } from '@/lib/types'
import {
  parseBloodPressureMeasurement, parseGlucoseMeasurement, parseHeartRateMeasurement, parsePulseOxMeasurement,
} from './parsers'

/* Minimal Web Bluetooth typings (not in the default DOM lib). */
type Char = EventTarget & { value?: DataView; startNotifications(): Promise<Char> }
type Service = { getCharacteristic(uuid: string | number): Promise<Char> }
type Server = { getPrimaryService(uuid: string | number): Promise<Service>; connected: boolean }
type Device = EventTarget & { name?: string; id: string; gatt?: { connect(): Promise<Server>; disconnect(): void; connected: boolean } }

const SERVICES: { service: number; char: number; key: VitalKey; parse: (d: Uint8Array) => Partial<Reading> }[] = [
  { service: 0x180d, char: 0x2a37, key: 'hr', parse: (d) => ({ value: parseHeartRateMeasurement(d).value, unit: 'bpm' }) },
  { service: 0x1822, char: 0x2a5f, key: 'spo2', parse: (d) => ({ value: Math.round(parsePulseOxMeasurement(d).value), unit: '%' }) },
  { service: 0x1810, char: 0x2a35, key: 'bp', parse: (d) => { const b = parseBloodPressureMeasurement(d); return { value: b.systolic, value2: b.diastolic, unit: 'mmHg' } } },
  { service: 0x1808, char: 0x2a18, key: 'glucose', parse: (d) => ({ value: parseGlucoseMeasurement(d).value, unit: 'mg/dL' }) },
]

let device: Device | null = null
let manualDisconnect = false

export const bluetoothSupported = () => typeof navigator !== 'undefined' && 'bluetooth' in navigator

function push(key: VitalKey, r: Partial<Reading>) {
  if (!r.value) return
  const now = Date.now()
  const reading: Reading = { value: r.value, value2: r.value2, unit: r.unit ?? '', source: device?.name ?? 'Wearable', measuredAt: now, receivedAt: now, quality: 'good' }
  set((s) => ({
    vitals: { ...s.vitals, [key]: reading },
    history: { ...s.history, [key]: [...s.history[key], reading.value].slice(-60) },
  }))
}

async function subscribe(server: Server) {
  const found: VitalKey[] = []
  for (const s of SERVICES) {
    try {
      const svc = await server.getPrimaryService(s.service)
      const ch = await svc.getCharacteristic(s.char)
      ch.addEventListener('characteristicvaluechanged', () => {
        if (ch.value) push(s.key, s.parse(new Uint8Array(ch.value.buffer)))
      })
      await ch.startNotifications()
      found.push(s.key)
    } catch {
      /* device doesn't offer this vital */
    }
  }
  return found
}

async function connectGatt() {
  if (!device?.gatt) throw new Error('Device has no data connection')
  set({ device: { status: 'connecting', name: device.name ?? 'Wearable', vitals: [] } })
  const server = await device.gatt.connect()
  const vitals = await subscribe(server)
  if (!vitals.length) throw new Error('This device does not share heart rate, oxygen, blood pressure or glucose.')
  set({ device: { status: 'connected', name: device.name ?? 'Wearable', vitals } })
  addLog('device', `Connected ${device.name ?? 'wearable'} (${vitals.join(', ')})`)
}

export async function pairWearable() {
  if (!bluetoothSupported()) throw new Error('Bluetooth is not available in this browser. Use Chrome on Android or a computer.')
  const bt = (navigator as unknown as { bluetooth: { requestDevice(o: unknown): Promise<Device> } }).bluetooth
  device = await bt.requestDevice({
    filters: SERVICES.map((s) => ({ services: [s.service] })),
    optionalServices: SERVICES.map((s) => s.service),
  })
  manualDisconnect = false
  set({ demoMode: false, scenario: 'stable' })
  device.addEventListener('gattserverdisconnected', onDisconnected)
  try {
    await connectGatt()
  } catch (e) {
    set({ device: { status: 'error', name: device.name ?? 'Wearable', vitals: [], error: (e as Error).message } })
    throw e
  }
}

async function onDisconnected() {
  if (manualDisconnect) return
  addLog('device', `${device?.name ?? 'Wearable'} disconnected — reconnecting`)
  set((s) => ({ device: { ...s.device, status: 'reconnecting' } }))
  for (let i = 0; i < 5 && !manualDisconnect; i++) {
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)))
    try {
      await connectGatt()
      return
    } catch {
      /* retry */
    }
  }
  set((s) => ({ device: { ...s.device, status: 'disconnected' } }))
}

export function disconnectWearable() {
  manualDisconnect = true
  device?.gatt?.disconnect()
  set({ device: { status: 'idle', name: null, vitals: [] }, vitals: {} })
  if (appStore.state.device.status === 'idle') addLog('device', 'Wearable disconnected')
}
