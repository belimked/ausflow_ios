import { alreadyApplied, applyPayload, dependsOn, isLocalId, localView, remapCommand, remapItem } from '../offline/queue'
import { data, pickup, profile } from './fixtures'

const at = '2026-10-21T02:00:00.000Z'

describe('ids', () => {
  it('recognises temporary ids', () => {
    expect(isLocalId('local-abc')).toBe(true)
    expect(isLocalId('PK0001')).toBe(false)
    expect(isLocalId(null)).toBe(false)
  })
})

describe('remapCommand / remapItem / dependsOn', () => {
  const finish = { kind: 'finishPickup' as const, at, pickupId: 'local-1', volume: 1, note: '', coords: null, userName: '' }

  it('rewrites temporary pickup ids and refuses unknown ones', () => {
    expect(remapCommand(finish, { 'local-1': 'PK0009' })).toEqual({ ...finish, pickupId: 'PK0009' })
    expect(remapCommand(finish, {})).toBeNull()
    expect(remapCommand({ ...finish, pickupId: 'PK0001' }, {})).toEqual({ ...finish, pickupId: 'PK0001' })
  })

  it('rewrites photo targets too', () => {
    expect(remapItem({ key: 'k', entityId: 'local-1' }, 'local-1', 'RI0001').entityId).toBe('RI0001')
  })

  it('knows which items wait for a temporary record', () => {
    expect(dependsOn({ key: 'a', cmd: finish }, 'local-1')).toBe(true)
    expect(dependsOn({ key: 'b', entityId: 'local-1' }, 'local-1')).toBe(true)
    expect(dependsOn({ key: 'c', entityId: 'local-2' }, 'local-1')).toBe(false)
  })
})

describe('alreadyApplied', () => {
  const started = pickup({ status: 'ongoing', startAt: at, endAt: null })

  it('finds a pickup started at the same moment by the same driver', () => {
    const d = data({ pickups: [started] })
    expect(alreadyApplied(d, { kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: null })).toBe('PK0001')
    expect(alreadyApplied(d, { kind: 'startPickup', at: '2026-10-21T02:00:01.000Z', deviceId: 'DV0001', profile, coords: null })).toBeNull()
  })

  it('treats a finish as applied when the pickup ended at that moment', () => {
    const d = data({ pickups: [pickup({ endAt: at })] })
    expect(alreadyApplied(d, { kind: 'finishPickup', at, pickupId: 'PK0001', volume: 1, note: '', coords: null, userName: '' })).toBe('')
  })

  it('matches unloads, transfers and issues by vehicle/device and time', () => {
    const d = data({
      unloads: [{ id: 'UL0001', vehicleId: 'VE0001', volume: 1, at }],
      transfers: [{ id: 'TR0001', fromVehicleId: 'VE0001', toVehicleId: 'VE0002', volume: 1, at }],
      reportedIssues: [{ id: 'RI0001', deviceId: 'DV0001', category: 'other', at, reportedBy: 'Sam', status: 'open', source: 'App' }],
    })
    expect(alreadyApplied(d, { kind: 'unload', at, profile, facilityId: 'FA', volume: 1, waste: '', coords: null })).toBe('UL0001')
    expect(alreadyApplied(d, { kind: 'transfer', at, profile, toVehicleId: 'VE0002', coords: null })).toBe('TR0001')
    expect(alreadyApplied(d, { kind: 'reportIssue', at, deviceId: 'DV0001', category: 'other', description: 'x', userName: 'Sam' })).toBe('RI0001')
  })
})

describe('applyPayload', () => {
  it('upserts, deletes and keeps the highest seq', () => {
    const d = data({ seq: { PK: 5 }, pickups: [pickup(), pickup({ id: 'PK0002' })] })
    const out = applyPayload(d, {
      upserts: { pickups: [{ id: 'PK0001', volume: 9 }, { id: 'PK0003', status: 'done' }], unknownTable: [{ id: 'x' }] },
      deletes: { pickups: ['PK0002'] },
      seq: { PK: 3, TR: 1 },
    })
    expect(out.pickups.map((p) => [p.id, p.volume])).toEqual([['PK0003', undefined], ['PK0001', 9]])
    expect(out.seq).toEqual({ PK: 5, TR: 1 })
    expect(d.pickups).toHaveLength(2)
  })
})

describe('localView', () => {
  it('leaves out queued commands that no longer fit the server data', () => {
    const d = data({ pickups: [pickup({ status: 'ongoing', driverId: 'DR0099' })] })
    const view = localView(d, [{ key: 'k', localId: 'local-1', cmd: { kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: null } }])
    expect(view.pickups.map((p) => p.id)).toEqual(['PK0001'])
  })
})
