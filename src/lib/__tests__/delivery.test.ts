import { CommandError, planCommand } from '../commands'
import { cycleWaste, nearbyFacilities, overCapacity, volumeGap } from '../delivery'
import type { LoadCycle } from '../load'
import type { Facility, Transfer, Unload, Vehicle } from '../types'
import { data, pickup, profile } from './fixtures'

const at = '2026-10-21T02:00:00.000Z'
const here = { lat: -34.9285, lng: 138.6007 }
const facility = (over: Partial<Facility>): Facility => ({ id: 'FA0001', name: 'Bolivar', lat: -34.77, lng: 138.58, status: 'active', ...over })
const vehicle = (over: Partial<Vehicle>): Vehicle => ({ id: 'VE0001', companyId: 'CO0001', plate: '111 AAA', tank: 4000, status: 'active', ...over })

describe('nearbyFacilities', () => {
  it('sorts active facilities by distance, unknown positions last', () => {
    const list = nearbyFacilities([
      facility({ id: 'far', name: 'Far', lat: -35.5, lng: 138.6 }),
      facility({ id: 'near', name: 'Near', lat: -34.93, lng: 138.6 }),
      facility({ id: 'nogps', name: 'A no GPS', lat: null, lng: null }),
      facility({ id: 'off', name: 'Closed', status: 'inactive' }),
    ], here)
    expect(list.map((x) => x.facility.id)).toEqual(['near', 'far', 'nogps'])
    expect(list[0].distance).toBeLessThan(1000)
  })

  it('falls back to name order without a position', () => {
    const list = nearbyFacilities([facility({ id: 'b', name: 'B' }), facility({ id: 'a', name: 'A' })], null)
    expect(list.map((x) => x.facility.id)).toEqual(['a', 'b'])
  })
})

describe('volumeGap / overCapacity', () => {
  it('measures the share between delivered and on board', () => {
    expect(volumeGap(1000, 1100)).toBeCloseTo(0.1)
    expect(volumeGap(1000, 850)).toBeCloseTo(0.15)
    expect(volumeGap(0, 500)).toBeNull()
  })
  it('flags a transfer that overfills the receiving tank', () => {
    expect(overCapacity(3000, 1500, 4000)).toBe(true)
    expect(overCapacity(2000, 2000, 4000)).toBe(false)
    expect(overCapacity(9000, 9000, null)).toBe(false)
  })
})

describe('cycleWaste', () => {
  it('picks the waste type with the most litres', () => {
    const cycle = { pickups: [
      pickup({ waste: 'Oily Water', volume: 300 }),
      pickup({ waste: 'Grease Trap Waste', volume: 200 }),
      pickup({ waste: 'Grease Trap Waste', volume: 200 }),
      pickup({ waste: 'Service only', volume: 0 }),
    ] } as LoadCycle
    expect(cycleWaste(cycle)).toBe('Grease Trap Waste')
    expect(cycleWaste(null)).toBe('')
  })
})

describe('unload', () => {
  const d = (over = {}) => data({
    seq: { UL: 3 }, vehicles: [vehicle({})], facilities: [facility({})], pickups: [pickup({ volume: 900 })], ...over,
  })
  const unload = (over: { volume?: number; facilityId?: string } = {}, dd = d()) =>
    planCommand(dd, { kind: 'unload', at, profile, facilityId: over.facilityId ?? 'FA0001', volume: over.volume ?? 900, waste: ' Grease Trap Waste ', coords: here })

  it('records the delivery against the driver and vehicle', () => {
    const plan = unload()
    expect(plan.result).toEqual({
      id: 'UL0004', companyId: 'CO0001', driverId: 'DR0001', vehicleId: 'VE0001', facilityId: 'FA0001',
      waste: 'Grease Trap Waste', volume: 900, at, lat: here.lat, lng: here.lng,
    })
    expect(plan.sync).toEqual({ upserts: { unloads: [plan.result as Unload] }, seq: { UL: 4 } })
  })

  it.each([
    ['the facility is inactive', {}, d({ facilities: [facility({ status: 'inactive' })] }), 'This facility is not accepting deliveries.'],
    ['the volume is empty', { volume: 0 }, d(), 'Enter the volume delivered.'],
    ['the vehicle is gone', {}, d({ vehicles: [] }), 'Your vehicle no longer exists. Choose your vehicle again.'],
    ['a pickup is still in progress', {}, d({ pickups: [pickup({ status: 'ongoing' })] }), 'Finish the pickup in progress first.'],
  ])('refuses when %s', (_, over, dd, message) => {
    expect(() => unload(over, dd)).toThrow(new CommandError(message))
  })
})

describe('transfer', () => {
  const d = (over = {}) => data({
    seq: { TR: 1 },
    vehicles: [vehicle({}), vehicle({ id: 'VE0002', plate: '222 BBB' }), vehicle({ id: 'VE0003', companyId: 'CO0009' })],
    pickups: [pickup({ volume: 600 }), pickup({ id: 'PK0002', volume: 250 })],
    ...over,
  })
  const transfer = (toVehicleId = 'VE0002', dd = d()) => planCommand(dd, { kind: 'transfer', at, profile, toVehicleId, coords: null })

  it('moves the whole load to the other vehicle', () => {
    const plan = transfer()
    expect(plan.result).toEqual({
      id: 'TR0002', companyId: 'CO0001', driverId: 'DR0001', fromVehicleId: 'VE0001', toVehicleId: 'VE0002',
      volume: 850, at, lat: null, lng: null,
    })
    expect(plan.sync).toEqual({ upserts: { transfers: [plan.result as Transfer] }, seq: { TR: 2 } })
  })

  it.each([
    ['the target is the same vehicle', 'VE0001', d(), 'Choose a different vehicle to transfer to.'],
    ['the target belongs to another company', 'VE0003', d(), 'You can only transfer to a vehicle of your company.'],
    ['the target is unknown', 'VE9999', d(), 'That vehicle is not active.'],
    ['nothing is on board', 'VE0002', d({ pickups: [] }), 'There is no waste on board to transfer.'],
  ])('refuses when %s', (_, to, dd, message) => {
    expect(() => transfer(to, dd)).toThrow(new CommandError(message))
  })
})
