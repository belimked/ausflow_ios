import { currentCycle, pickupDelivery, traceForward, vehicleCycles, vehicleLoads } from '../load'
import { pickup, transfer, unload } from './fixtures'

const p1 = pickup()
const p2 = pickup({ id: 'PK0002', volume: 300, endAt: '2026-10-01T02:00:00.000Z' })
const ongoing = pickup({ id: 'PK0003', status: 'ongoing', volume: null, endAt: null })

describe('vehicleLoads', () => {
  it('sums finished pickups and ignores ongoing ones', () => {
    const m = vehicleLoads({ pickups: [p1, p2, ongoing], transfers: [], unloads: [] })
    expect(m.get('VE0001')).toBe(800)
  })

  it('moves volume on transfer and removes it on unload', () => {
    const m = vehicleLoads({ pickups: [p1, p2], transfers: [transfer({ volume: 800 })], unloads: [unload({ volume: 800 })] })
    expect(m.get('VE0001')).toBe(0)
    expect(m.get('VE0002')).toBe(0)
  })
})

describe('vehicleCycles / currentCycle', () => {
  it('keeps the cycle open until the vehicle is emptied', () => {
    const d = { pickups: [p1, p2], transfers: [], unloads: [] }
    const c = currentCycle(d, 'VE0001')
    expect(c?.pickups.map((p) => p.id)).toEqual(['PK0001', 'PK0002'])
    expect(c?.inflow).toBe(800)
  })

  it('closes the cycle at a transfer and opens one on the receiving vehicle', () => {
    const d = { pickups: [p1, p2], transfers: [transfer({ volume: 800 })], unloads: [] }
    const cycles = vehicleCycles(d)
    expect(cycles.find((c) => c.vehicleId === 'VE0001')?.endKind).toBe('transfer')
    expect(currentCycle(d, 'VE0001')).toBeNull()
    expect(currentCycle(d, 'VE0002')?.transfersIn).toHaveLength(1)
  })

  it('starts a new cycle for pickups after an unload', () => {
    const later = pickup({ id: 'PK0009', vehicleId: 'VE0002', endAt: '2026-10-01T06:00:00.000Z' })
    const d = { pickups: [later], transfers: [transfer()], unloads: [unload()] }
    expect(vehicleCycles(d).filter((c) => c.vehicleId === 'VE0002')).toHaveLength(2)
    expect(currentCycle(d, 'VE0002')?.pickups.map((p) => p.id)).toEqual(['PK0009'])
  })
})

describe('traceForward / pickupDelivery', () => {
  it('follows a transfer to the unload', () => {
    const d = { transfers: [transfer()], unloads: [unload()] }
    const t = traceForward(d, p1)
    expect(t.finished).toBe(true)
    expect(t.hops.map((h) => h.kind)).toEqual(['pickup', 'transfer', 'unload'])
    expect(pickupDelivery(d, p1)).toMatchObject({ state: 'delivered', facilityId: 'FA0001', vehicleId: 'VE0002' })
  })

  it('reports on board while nothing has been unloaded', () => {
    expect(pickupDelivery({ transfers: [], unloads: [] }, p1)).toMatchObject({ state: 'onboard', vehicleId: 'VE0001' })
  })

  it('ignores unloads that happened before the pickup finished', () => {
    const early = unload({ vehicleId: 'VE0001', at: '2026-10-01T00:00:00.000Z' })
    expect(pickupDelivery({ transfers: [], unloads: [early] }, p1).state).toBe('onboard')
  })

  it('reports progress for ongoing pickups', () => {
    expect(pickupDelivery({ transfers: [], unloads: [] }, ongoing).state).toBe('progress')
  })
})
