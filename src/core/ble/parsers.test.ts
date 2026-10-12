import { describe, expect, it } from 'vitest'

import {
  decodeIEEE11073Float,
  decodeIEEE11073SFloat,
  parseBloodPressureMeasurement,
  parseGlucoseMeasurement,
  parseHeartRateMeasurement,
  parsePulseOxMeasurement,
} from './parsers'

describe('BLE parsers', () => {
  it('decodes an 8-bit heart rate measurement', () => {
    const result = parseHeartRateMeasurement(new Uint8Array([0x06, 0x48]))
    expect(result.value).toBe(72)
    expect(result.unit).toBe('bpm')
    expect(result.contactDetected).toBe(true)
  })

  it('decodes a 16-bit blood pressure measurement', () => {
    const result = parseBloodPressureMeasurement(new Uint8Array([0x06, 0x7c, 0x00, 0x50, 0x00, 0x82, 0x00]))
    expect(result.systolic).toBe(124)
    expect(result.diastolic).toBe(80)
    expect(result.meanArterialPressure).toBe(130)
  })

  it('decodes a pulse oximeter reading', () => {
    const result = parsePulseOxMeasurement(new Uint8Array([0x06, 0x61, 0x00, 0x00, 0x00]))
    expect(result.value).toBe(97)
    expect(result.unit).toBe('%')
  })

  it('decodes a glucose sample', () => {
    const result = parseGlucoseMeasurement(new Uint8Array([0x00, 0x00, 0x70, 0x00]))
    expect(result.value).toBe(112)
    expect(result.unit).toBe('mg/dL')
  })

  it('decodes common 11073 float values', () => {
    expect(decodeIEEE11073SFloat([0x00, 0x00])).toBe(0)
    expect(decodeIEEE11073SFloat([0xF5, 0x00])).toBeCloseTo(24.5, 5)
    expect(decodeIEEE11073Float([0x00, 0x00])).toBe(0)
    expect(decodeIEEE11073Float([0x64, 0x00])).toBeCloseTo(1, 5)
  })
})
