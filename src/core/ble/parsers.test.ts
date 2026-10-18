import { describe, expect, it } from 'vitest'
import { decodeIEEE11073Float,decodeIEEE11073SFloat,parseBloodPressureMeasurement,parseGlucoseMeasurement,parseHeartRateMeasurement,parsePulseOxMeasurement } from './parsers'
describe('Standard Bluetooth health measurements',()=>{
 it('decodes 8-bit heart rate',()=>expect(parseHeartRateMeasurement(new Uint8Array([6,72])).value).toBe(72))
 it('skips energy before converting RR units',()=>expect(parseHeartRateMeasurement(new Uint8Array([0x18,72,3,0,0,4])).rrIntervalMs).toEqual([1000]))
 it('decodes signed SFLOAT exponent',()=>expect(decodeIEEE11073SFloat([0xf5,0xf0])).toBeCloseTo(24.5))
 it('decodes signed SFLOAT mantissa',()=>expect(decodeIEEE11073SFloat([0xff,0x0f])).toBe(-1))
 it('decodes full 32-bit FLOAT',()=>expect(decodeIEEE11073Float([100,0,0,254])).toBe(1))
 it('decodes blood pressure SFLOAT values',()=>expect(parseBloodPressureMeasurement(new Uint8Array([0,124,0,80,0,90,0])).systolic).toBe(124))
 it('converts kPa to mmHg',()=>expect(parseBloodPressureMeasurement(new Uint8Array([1,16,0,10,0,12,0])).systolic).toBeCloseTo(120.009869))
 it('decodes continuous pulse oxygen SFLOAT values',()=>expect(parsePulseOxMeasurement(new Uint8Array([0,97,0,72,0]))).toEqual({value:97,pulseRate:72,unit:'%'}))
 it('converts glucose kg/L to mg/dL',()=>expect(parseGlucoseMeasurement(new Uint8Array([2,1,0,0,0,0,0,0,0,0,112,0xb0,0])).value).toBeCloseTo(112))
 it('rejects missing glucose instead of fabricating 112',()=>expect(()=>parseGlucoseMeasurement(new Uint8Array())).toThrow())
 it('rejects truncated BP optional fields',()=>expect(()=>parseBloodPressureMeasurement(new Uint8Array([6,124,0,80,0,90,0]))).toThrow())
 it('rejects truncated PLX fields',()=>expect(()=>parsePulseOxMeasurement(new Uint8Array([6,97,0,72,0]))).toThrow())
 it('rejects invalid SFLOAT sentinel',()=>expect(()=>decodeIEEE11073SFloat([0xff,7])).toThrow())
})
