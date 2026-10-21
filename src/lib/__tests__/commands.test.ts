import { CommandError, planCommand } from '../commands'
import type { Pickup } from '../types'
import { data, device, pickup, profile } from './fixtures'

const at = '2026-10-21T02:00:00.000Z'
const here = { lat: -34.9285, lng: 138.6007 }

describe('startPickup', () => {
  it('creates an ongoing pickup with the next PK id and the device waste', () => {
    const plan = planCommand(data({ seq: { PK: 4 } }), { kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: here })
    const p = plan.result as Pickup
    expect(p).toMatchObject({
      id: 'PK0005', status: 'ongoing', startAt: at, deviceId: 'DV0001', locationId: 'LO0001',
      driverId: 'DR0001', vehicleId: 'VE0001', waste: 'Grease Trap Waste', distance: 0, startLat: here.lat,
    })
    expect(plan.sync).toEqual({ upserts: { pickups: [p] }, seq: { PK: 5 } })
  })

  it('defaults the waste type when the device has none', () => {
    const p = planCommand(data({ devices: [device({ waste: '  ' })] }), { kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: null }).result as Pickup
    expect(p.waste).toBe('Grease Trap Waste')
    expect(p.distance).toBeNull()
  })

  it.each([
    ['the device is gone', data({ devices: [] }), 'This device no longer exists.'],
    ['the device is busy', data({ pickups: [pickup({ status: 'ongoing', driverId: 'DR0099' })] }), 'A pickup is already in progress at this device.'],
    ['the driver is busy', data({ pickups: [pickup({ status: 'ongoing', deviceId: 'DV0099' })] }), 'You already have a pickup in progress. Finish it before starting another.'],
  ])('refuses when %s', (_, d, message) => {
    expect(() => planCommand(d, { kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: here })).toThrow(new CommandError(message))
  })
})

describe('finishPickup', () => {
  const running = pickup({ status: 'ongoing', volume: null, endAt: null, distance: 5 })
  const finish = (over: { volume?: number; coords?: typeof here | null }, d = data({ pickups: [running], seq: { CL: 9 } })) =>
    planCommand(d, { kind: 'finishPickup', at, pickupId: 'PK0001', volume: over.volume ?? 400, note: '  gate locked ', coords: over.coords === undefined ? here : over.coords, userName: 'Sam' })

  it('completes the pickup, updates last service and logs the change', () => {
    const plan = finish({})
    const done = plan.result as Pickup
    expect(done).toMatchObject({ status: 'done', volume: 400, note: 'gate locked', endAt: at, flags: [], distance: 0 })
    expect(plan.sync?.upserts.devices).toEqual([expect.objectContaining({ id: 'DV0001', lastService: at })])
    expect(plan.sync?.upserts.changeLogs).toEqual([expect.objectContaining({
      id: 'CL0010', field: 'Last service', oldValue: '2026-09-01', newValue: '2026-10-21', user: 'Sam', source: 'App',
    })])
    expect(plan.sync?.seq).toEqual({ CL: 10 })
  })

  it('flags a finish far from the device', () => {
    expect((finish({ coords: { lat: -34.94, lng: 138.6007 } }).result as Pickup).flags).toEqual(['location'])
  })

  it('flags a missing location and keeps the start distance', () => {
    const done = finish({ coords: null }).result as Pickup
    expect(done.flags).toEqual(['nolocation'])
    expect(done.distance).toBe(5)
  })

  it('flags a volume above the trap capacity', () => {
    expect((finish({ volume: 1200 }).result as Pickup).flags).toEqual(['capacity'])
  })

  it.each([
    ['it was removed', data(), 'This pickup was removed by someone else.'],
    ['it is already done', data({ pickups: [pickup()] }), 'This pickup has already been completed.'],
  ])('refuses when %s', (_, d, message) => {
    expect(() => finish({}, d)).toThrow(new CommandError(message))
  })
})

describe('cancelPickup', () => {
  it('deletes an ongoing pickup', () => {
    const plan = planCommand(data({ pickups: [pickup({ status: 'ongoing' })], seq: { PK: 1 } }), { kind: 'cancelPickup', at, pickupId: 'PK0001' })
    expect(plan.sync).toEqual({ upserts: {}, deletes: { pickups: ['PK0001'] }, seq: { PK: 1 } })
  })

  it('does nothing for a finished or missing pickup', () => {
    expect(planCommand(data({ pickups: [pickup()] }), { kind: 'cancelPickup', at, pickupId: 'PK0001' }).sync).toBeNull()
    expect(planCommand(data(), { kind: 'cancelPickup', at, pickupId: 'PK0001' }).sync).toBeNull()
  })
})
