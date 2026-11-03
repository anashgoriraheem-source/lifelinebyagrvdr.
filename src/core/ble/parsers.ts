export type HeartRateMeasurement = { value: number; unit: 'bpm'; contactDetected: boolean; energyExpended: boolean; rrIntervalMs: number[] }
export type BloodPressureMeasurement = { systolic: number; diastolic: number; meanArterialPressure: number; unit: 'mmHg'; measuredAt?: number }
export type PulseOxMeasurement = { value: number; unit: '%'; pulseRate?: number }
export type GlucoseMeasurement = { value: number; unit: 'mg/dL'; sequenceNumber?: number }
function requireBytes(bytes: ArrayLike<number>, length: number) { if(bytes.length < length) throw new Error('Incomplete Bluetooth measurement') }
function word(bytes: ArrayLike<number>, offset: number) { requireBytes(bytes,offset+2); return bytes[offset] | bytes[offset+1] << 8 }
export function decodeIEEE11073SFloat(bytes: number[] | Uint8Array): number {
  const raw=word(bytes,0),mantissa=raw&0x0fff
  if([0x07fe,0x07ff,0x0800,0x0801,0x0802].includes(mantissa)) throw new Error('Invalid Bluetooth measurement')
  const exponent=raw>>12
  return (mantissa&0x0800 ? mantissa-0x1000 : mantissa)*10**(exponent&8 ? exponent-16 : exponent)
}
export function decodeIEEE11073Float(bytes: number[] | Uint8Array): number {
  requireBytes(bytes,4)
  const mantissa=bytes[0]|bytes[1]<<8|bytes[2]<<16
  if([0x7ffffe,0x7fffff,0x800000,0x800001,0x800002].includes(mantissa)) throw new Error('Invalid Bluetooth measurement')
  const exponent=bytes[3]>127?bytes[3]-256:bytes[3]
  return (mantissa&0x800000?mantissa-0x1000000:mantissa)*10**exponent
}
export function parseHeartRateMeasurement(data: Uint8Array): HeartRateMeasurement {
  requireBytes(data,2)
  const flags=data[0],wide=!!(flags&1)
  const value=wide?word(data,1):data[1]
  let offset=wide?3:2
  if(flags&8){word(data,offset);offset+=2}
  const rrIntervalMs:number[]=[]
  if(flags&16){ if((data.length-offset)%2) throw new Error('Incomplete RR interval'); for(;offset<data.length;offset+=2)rrIntervalMs.push(word(data,offset)*1000/1024) }
  if(value<=0) throw new Error('Invalid heart rate')
  return {value,unit:'bpm',contactDetected:(flags&6)===6,energyExpended:!!(flags&8),rrIntervalMs}
}
/** GATT date-time (year, month, day, hours, minutes, seconds). Returns undefined when implausible. */
function deviceTimestamp(data: ArrayLike<number>, offset: number): number | undefined {
  const year = word(data, offset)
  const [, month, day, hours, minutes, seconds] = [
    year,
    data[offset + 2],
    data[offset + 3],
    data[offset + 4],
    data[offset + 5],
    data[offset + 6],
  ]
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return undefined
  if (day < 1 || day > 31 || hours > 23 || minutes > 59 || seconds > 59) return undefined
  const at = new Date(year, month - 1, day, hours, minutes, seconds).getTime()
  return Number.isFinite(at) ? at : undefined
}
export function parseBloodPressureMeasurement(data: Uint8Array): BloodPressureMeasurement {
  requireBytes(data,7)
  let required=7
  if(data[0]&2)required+=7
  if(data[0]&4)required+=2
  if(data[0]&8)required+=1
  if(data[0]&16)required+=2
  requireBytes(data,required)
  const scale=data[0]&1?7.50061683:1
  const read=(offset:number)=>decodeIEEE11073SFloat(data.subarray(offset,offset+2))*scale
  const systolic=read(1),diastolic=read(3),meanArterialPressure=read(5)
  if(systolic<=0||diastolic<=0)throw new Error('Invalid blood pressure')
  // The cuff's own clock is only trusted when the field is present and sane;
  // otherwise the reading keeps the time the browser received it.
  const measuredAt = data[0]&2 ? deviceTimestamp(data,7) : undefined
  return {systolic,diastolic,meanArterialPressure,unit:'mmHg',measuredAt}
}
/** PLX Continuous Measurement characteristic 0x2a5f. */
export function parsePulseOxMeasurement(data: Uint8Array): PulseOxMeasurement {
  requireBytes(data,5)
  let required=5
  if(data[0]&1)required+=4
  if(data[0]&2)required+=4
  if(data[0]&4)required+=2
  if(data[0]&8)required+=3
  if(data[0]&16)required+=2
  requireBytes(data,required)
  const value=decodeIEEE11073SFloat(data.subarray(1,3)),pulseRate=decodeIEEE11073SFloat(data.subarray(3,5))
  if(value<=0||value>100||pulseRate<0)throw new Error('Invalid oxygen measurement')
  return {value,pulseRate,unit:'%'}
}
export function parseGlucoseMeasurement(data: Uint8Array): GlucoseMeasurement {
  requireBytes(data,10)
  const flags=data[0]
  if(!(flags&2))throw new Error('Glucose concentration not provided')
  const offset=10+(flags&1?2:0)
  requireBytes(data,offset+3+(flags&8?2:0))
  const concentration=decodeIEEE11073SFloat(data.subarray(offset,offset+2))
  const value=concentration*(flags&4?18015.59:100000)
  if(value<=0||!Number.isFinite(value))throw new Error('Invalid glucose concentration')
  return {value,unit:'mg/dL',sequenceNumber:word(data,1)}
}
