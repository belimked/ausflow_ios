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

  it.each([['CO0099', 'another company'], [null, 'unassigned']] as const)('starts a device %s (%s)', (companyId, _label) => {
    const d = data({ devices: [device({ companyId })] })
    expect((planCommand(d, { kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: here }).result as Pickup).companyId).toBe(profile.companyId)
    expect((planCommand(d, { kind: 'serviceOnly', at, deviceId: 'DV0001', profile, coords: here, note: '', userName: 'Sam' }).result as Pickup).status).toBe('done')
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
  const finish = (over: { volume?: number; coords?: { lat: number; lng: number; accuracy?: number } | null }, d = data({ pickups: [running], seq: { CL: 9 } })) =>
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
    // ~300 m away: a coarse fix that could still be within 200 m of the device is not flagged, a sharp one is.
    expect((finish({ coords: { lat: -34.9312, lng: 138.6007, accuracy: 150 } }).result as Pickup).flags).toEqual([])
    expect((finish({ coords: { lat: -34.9312, lng: 138.6007, accuracy: 50 } }).result as Pickup).flags).toEqual(['location'])
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

describe('finishPickup waste type', () => {
  const running = pickup({ status: 'ongoing', volume: null, endAt: null, waste: 'Grease Trap Waste' })
  const finish = (waste?: string) => planCommand(data({ pickups: [running] }),
    { kind: 'finishPickup', at, pickupId: 'PK0001', volume: 100, note: '', coords: here, userName: 'Sam', waste }).result as Pickup

  it('uses the waste type chosen by the driver', () => {
    expect(finish(' Oily  Water ').waste).toBe('Oily Water')
  })
  it('keeps the existing waste type when none is chosen', () => {
    expect(finish().waste).toBe('Grease Trap Waste')
    expect(finish('  ').waste).toBe('Grease Trap Waste')
  })
})

describe('finishPickup destination and photos', () => {
  const running = pickup({ status: 'ongoing', volume: null, endAt: null, photos: 1 })
  const finish = (extra: { plannedFacilityId?: string | null; photos?: number }) => planCommand(data({ pickups: [running] }),
    { kind: 'finishPickup', at, pickupId: 'PK0001', volume: 100, note: '', coords: here, userName: 'Sam', ...extra }).result as Pickup

  it('records the planned destination facility', () => {
    expect(finish({ plannedFacilityId: 'FA0001' }).plannedFacilityId).toBe('FA0001')
    expect(finish({}).plannedFacilityId).toBeNull()
  })
  it('adds the photos taken to the pickup count', () => {
    expect(finish({ photos: 2 }).photos).toBe(3)
    expect(finish({}).photos).toBe(1)
  })
})

describe('serviceOnly', () => {
  const service = (d = data({ seq: { PK: 2, CL: 5 } }), coords: typeof here | null = here) =>
    planCommand(d, { kind: 'serviceOnly', at, deviceId: 'DV0001', profile, coords, note: ' lid cleaned ', userName: 'Sam' })

  it('records a finished 0 L pickup and services the device', () => {
    const plan = service()
    expect(plan.result).toMatchObject({
      id: 'PK0003', status: 'done', volume: 0, waste: 'Service only', startAt: at, endAt: at,
      note: 'lid cleaned', flags: [], distance: 0, vehicleId: 'VE0001',
    })
    expect(plan.sync?.upserts.devices).toEqual([expect.objectContaining({ lastService: at })])
    expect(plan.sync?.upserts.changeLogs).toEqual([expect.objectContaining({ id: 'CL0006', user: 'Sam' })])
    expect(plan.sync?.seq).toEqual({ PK: 3, CL: 6 })
  })

  it('flags a missing location', () => {
    expect((service(undefined, null).result as Pickup).flags).toEqual(['nolocation'])
  })

  it('follows the same rules as starting a pickup', () => {
    expect(() => service(data({ pickups: [pickup({ status: 'ongoing', driverId: 'DR0099' })] }))).toThrow('A pickup is already in progress at this device.')
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
