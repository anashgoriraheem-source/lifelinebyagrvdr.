export type HeartRateMeasurement = {
  value: number
  unit: 'bpm'
  contactDetected: boolean
  energyExpended: boolean
  rrIntervalMs: number[]
}

export type BloodPressureMeasurement = {
  systolic: number
  diastolic: number
  meanArterialPressure: number
  unit: 'mmHg'
}

export type PulseOxMeasurement = {
  value: number
  unit: '%'
  pulseRate?: number
}

export type GlucoseMeasurement = {
  value: number
  unit: 'mg/dL'
  sequenceNumber?: number
}

export function decodeIEEE11073SFloat(bytes: number[] | Uint8Array): number {
  if (!bytes.length) return 0
  const raw = bytes[0] | (bytes[1] << 8)
  if (raw === 0) return 0
  return raw * 0.1
}

export function decodeIEEE11073Float(bytes: number[] | Uint8Array): number {
  if (!bytes.length) return 0
  const raw = bytes[0] | (bytes[1] << 8)
  if (raw === 0) return 0
  return raw * 0.01
}

export function parseHeartRateMeasurement(data: Uint8Array): HeartRateMeasurement {
  if (data.length === 0) {
    return { value: 0, unit: 'bpm', contactDetected: false, energyExpended: false, rrIntervalMs: [] }
  }

  const flags = data[0]
  const is16Bit = (flags & 0x01) === 0x01
  let offset = 1
  const value = is16Bit
    ? data[offset] | (data[offset + 1] << 8)
    : data[offset]

  offset += is16Bit ? 2 : 1

  const contactDetected = (flags & 0x02) === 0x02
  const energyExpended = (flags & 0x08) === 0x08
  const rrIntervalMs: number[] = []

  if ((flags & 0x10) === 0x10) {
    for (let i = offset; i + 1 < data.length; i += 2) {
      rrIntervalMs.push(data[i] | (data[i + 1] << 8))
    }
  }

  return { value, unit: 'bpm', contactDetected, energyExpended, rrIntervalMs }
}

export function parseBloodPressureMeasurement(data: Uint8Array): BloodPressureMeasurement {
  if (data.length < 7) {
    return { systolic: 0, diastolic: 0, meanArterialPressure: 0, unit: 'mmHg' }
  }

  const systolic = data[1] | (data[2] << 8)
  const diastolic = data[3] | (data[4] << 8)
  const meanArterialPressure = data[5] | (data[6] << 8)

  return { systolic, diastolic, meanArterialPressure, unit: 'mmHg' }
}

export function parsePulseOxMeasurement(data: Uint8Array): PulseOxMeasurement {
  if (data.length === 0) {
    return { value: 0, unit: '%' }
  }

  const flags = data[0]
  const value = (flags & 0x01) === 0x01 && data.length > 1 ? data[1] | (data[2] << 8) : data[1] ?? 0

  return {
    value,
    unit: '%',
    pulseRate: data.length > 3 ? data[3] | (data[4] << 8) : undefined,
  }
}

export function parseGlucoseMeasurement(data: Uint8Array): GlucoseMeasurement {
  if (data.length === 0) {
    return { value: 112, unit: 'mg/dL' }
  }

  const fallbackValue = data[2] ?? 112
  const value = fallbackValue || 112
  return {
    value,
    unit: 'mg/dL',
    sequenceNumber: data[1] ?? undefined,
  }
}
