import type { Scanned } from '../codes'
import { scanAction } from '../scan'
import { device } from './fixtures'

const dev: Scanned = { kind: 'device', item: device() }
const own: Scanned = { kind: 'vehicle', item: { id: 'VE0001', plate: '111 AAA', status: 'active' } }
const other: Scanned = { kind: 'vehicle', item: { id: 'VE0002', plate: '222 BBB', status: 'active' } }
const plant: Scanned = { kind: 'facility', item: { id: 'FA0001', name: 'Bolivar', status: 'active' } }
const empty = { vehicleId: 'VE0001', onBoard: 0 }
const loaded = { vehicleId: 'VE0001', onBoard: 800 }

describe('scanAction from Today (any)', () => {
  it('opens devices and offloads at facilities', () => {
    expect(scanAction(dev, 'x', 'any', empty)).toEqual({ go: 'device', id: 'DV0001' })
    expect(scanAction(plant, 'x', 'any', empty)).toEqual({ go: 'offload', facilityId: 'FA0001' })
  })

  it('joins a vehicle, or offers join/transfer when carrying waste', () => {
    expect(scanAction(other, 'x', 'any', empty)).toEqual({ go: 'join', vehicleId: 'VE0002' })
    expect(scanAction(other, 'x', 'any', loaded)).toEqual({ go: 'joinOrTransfer', vehicleId: 'VE0002' })
    expect(scanAction(own, 'x', 'any', loaded)).toEqual({ go: 'join', vehicleId: 'VE0001' })
  })

  it('explains unknown codes', () => {
    expect(scanAction(null, 'http://QR2id.net/?X@zz9', 'any', empty)).toEqual({ problem: 'No device, vehicle or facility found for “ZZ9”' })
  })
})

describe('scanAction in a single-purpose mode', () => {
  it('vehicle mode only joins vehicles', () => {
    expect(scanAction(other, 'x', 'vehicle', loaded)).toEqual({ go: 'join', vehicleId: 'VE0002' })
    expect(scanAction(dev, 'x', 'vehicle', empty)).toEqual({ problem: 'That is not a vehicle sticker.' })
    expect(scanAction(null, 'abc', 'vehicle', empty)).toEqual({ problem: 'No vehicle found for “ABC”' })
  })

  it('facility mode only accepts facility plates', () => {
    expect(scanAction(plant, 'x', 'facility', empty)).toEqual({ go: 'offload', facilityId: 'FA0001' })
    expect(scanAction(other, 'x', 'facility', empty)).toEqual({ problem: 'That is not a facility plate.' })
  })

  it('transfer mode needs another vehicle', () => {
    expect(scanAction(other, 'x', 'transfer', loaded)).toEqual({ go: 'transfer', vehicleId: 'VE0002' })
    expect(scanAction(own, 'x', 'transfer', loaded)).toEqual({ problem: 'That is your own vehicle. Scan the vehicle receiving the waste.' })
    expect(scanAction(plant, 'x', 'transfer', loaded)).toEqual({ problem: 'That is not a vehicle sticker.' })
  })
})
