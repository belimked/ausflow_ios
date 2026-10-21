import { currentCycle } from '../load'
import { mockTrailers, pruneAssignments, trailerLoads } from '../mock/trailers'
import { pickup, unload } from './fixtures'

describe('mockTrailers', () => {
  it('gives each company the same 2-3 demo trailers every time', () => {
    const a = mockTrailers('CO0001')
    expect(a).toEqual(mockTrailers('CO0001'))
    expect(a.length).toBeGreaterThanOrEqual(2)
    expect(a.length).toBeLessThanOrEqual(3)
    expect(a.every((t) => t.id.startsWith('MOCK-TRAILER-CO0001-') && t.companyId === 'CO0001')).toBe(true)
    expect(new Set(a.map((t) => t.id)).size).toBe(a.length)
  })
})

describe('trailerLoads', () => {
  const p1 = pickup({ id: 'PK0001', volume: 500 })
  const p2 = pickup({ id: 'PK0002', volume: 300, endAt: '2026-10-01T02:00:00.000Z' })
  const assigned = { PK0001: 'T1', PK0002: 'T1', PK0009: 'T2' }

  it('sums the pickups assigned to each trailer that are still on board', () => {
    const cycle = currentCycle({ pickups: [p1, p2], transfers: [], unloads: [] }, 'VE0001')
    expect(trailerLoads(assigned, cycle)).toEqual(new Map([['T1', 800]]))
  })

  it('empties with the truck once it is offloaded', () => {
    const cycle = currentCycle({ pickups: [p1, p2], transfers: [], unloads: [unload({ vehicleId: 'VE0001' })] }, 'VE0001')
    expect(trailerLoads(assigned, cycle).size).toBe(0)
  })
})

describe('pruneAssignments', () => {
  it('keeps only pickups still on board', () => {
    expect(pruneAssignments({ PK1: 'T1', PK2: 'T2' }, new Set(['PK2']))).toEqual({ PK2: 'T2' })
  })
})
