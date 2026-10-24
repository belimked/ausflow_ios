import { dashboardSummary, deviceCounts, dueBuckets, filterDevices, legsOf, overdueByCompany, pickupsPerDay, sortByDue, workDays } from '../admin'
import type { AppData, Device, Pickup } from '../types'

const DAY = 864e5
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()
const dev = (id: string, o: Partial<Device> = {}): Device => ({ id, ref: id, status: 'Active', freqWeeks: 4, lastService: iso(7), ...o })
const pick = (id: string, daysAgo: number, o: Partial<Pickup> = {}): Pickup => ({ id, status: 'done', startAt: iso(daysAgo), endAt: iso(daysAgo), volume: 1000, ...o })

const devices = [
  dev('ok1'),
  dev('late1', { lastService: iso(60), companyId: 'A' }),
  dev('late2', { lastService: iso(40), companyId: 'A' }),
  dev('late3', { lastService: iso(35), companyId: 'B' }),
  dev('soon1', { lastService: iso(26) }),
  dev('nosched', { freqWeeks: null }),
  dev('gone', { status: 'Inactive', lastService: iso(90) }),
]

test('due buckets count only active devices', () => {
  expect(dueBuckets(devices)).toEqual({ overdue: 3, soon: 1, ok: 1, none: 1, active: 6 })
  expect(deviceCounts(devices)).toEqual({ all: 6, overdue: 3, soon: 1, inactive: 1 })
})

test('filters match the segmented control', () => {
  expect(filterDevices(devices, 'overdue').map((d) => d.id).sort()).toEqual(['late1', 'late2', 'late3'])
  expect(filterDevices(devices, 'soon').map((d) => d.id)).toEqual(['soon1'])
  expect(filterDevices(devices, 'inactive').map((d) => d.id)).toEqual(['gone'])
  expect(filterDevices(devices, 'all')).toHaveLength(6)
})

test('overdue ranking is worst company first', () => {
  const r = overdueByCompany(devices)
  expect(r.map((x) => [x.companyId, x.total])).toEqual([['A', 2], ['B', 1]])
  expect(r[0].worstDays).toBeGreaterThan(30)
})

test('sort by due puts the latest first and unscheduled last', () => {
  const ids = sortByDue(devices.filter((d) => d.status === 'Active')).map((d) => d.id)
  expect(ids[0]).toBe('late1')
  expect(ids[ids.length - 1]).toBe('nosched')
})

test('pickups per day fills every day and ignores ongoing ones', () => {
  const rows = pickupsPerDay([pick('a', 0), pick('b', 0, { volume: 500 }), pick('c', 2), pick('x', 1, { status: 'ongoing', endAt: null })], 3)
  expect(rows.map((r) => r.count)).toEqual([1, 0, 2])
  expect(rows[2].litres).toBe(1500)
})

test('dashboard summary compares this week with last', () => {
  const d = { devices, pickups: [pick('a', 1), pick('b', 2), pick('c', 9, { flags: ['nolocation'] })], locations: [], facilities: [], companies: [], reportedIssues: [], transfers: [], unloads: [], drivers: [], vehicles: [], seq: {} } as unknown as AppData
  const s = dashboardSummary(d)
  expect(s.p7).toBe(2)
  expect(s.trend).toBe(100)
  expect(s.flagged).toBe(1)
  expect(s.compliance).toBe(50)
})

test('work days group a driver activity by day with hours and flags', () => {
  const d = {
    pickups: [
      pick('a', 0, { driverId: 'D', startAt: new Date(Date.now() - 3 * 3600e3).toISOString(), endAt: new Date(Date.now() - 2.5 * 3600e3).toISOString() }),
      pick('b', 0, { driverId: 'D', startAt: new Date(Date.now() - 1 * 3600e3).toISOString(), endAt: new Date(Date.now() - 0.5 * 3600e3).toISOString(), flags: ['nolocation'] }),
      pick('c', 3, { driverId: 'D' }),
      pick('x', 0, { driverId: 'OTHER' }),
    ],
    unloads: [{ id: 'u1', vehicleId: 'V', driverId: 'D', volume: 2000, at: new Date(Date.now() - 0.2 * 3600e3).toISOString() }],
    transfers: [],
  } as unknown as AppData
  const days = workDays(d, { driverId: 'D' })
  expect(days).toHaveLength(2)
  expect(days[0].jobs).toBe(2)
  expect(days[0].litres).toBe(2000)
  expect(days[0].flags).toBe(1)
  expect(days[0].minutes).toBeGreaterThanOrEqual(167)
  expect(days[0].events.map((e) => e.kind)).toEqual(['pickup', 'pickup', 'unload'])
  const legs = legsOf(days[0].events, () => 1000)
  expect(legs[0].metres).toBeNull()
  expect(legs[1].minutes).toBe(120)
  expect(legs[1].slow).toBe(false)
  expect(legs[2].metres).toBe(1000)
})
