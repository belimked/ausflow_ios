import { alertCounts, alertIdOf, alertViews, deriveAlerts, statusMap } from '../alerts'
import type { AppData } from '../types'

const DAY = 864e5
const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY).toISOString()

const base = (): AppData => ({
  seq: {}, companies: [{ id: 'C1', name: 'Metro', status: 'Active', types: '["transport"]' }], locations: [{ id: 'L1', name: 'Bistro', status: 'Active' }],
  devices: [
    { id: 'D1', ref: 'DV1', status: 'Active', freqWeeks: 4, lastService: iso(100), locationId: 'L1', companyId: 'C1' },
    { id: 'D2', ref: 'DV2', status: 'Active', freqWeeks: 4, lastService: iso(35), locationId: 'L1', companyId: 'C1' },
    { id: 'D3', ref: 'DV3', status: 'Active', freqWeeks: 4, lastService: iso(7), locationId: 'L1', companyId: 'C1' },
  ],
  drivers: [{ id: 'DR', name: 'Dylan', status: 'Active' }], vehicles: [{ id: 'V1', plate: '122 4SZ', tank: 5000, status: 'active', companyId: 'C1' }],
  facilities: [], transfers: [], unloads: [],
  pickups: [
    { id: 'PK-D1', status: 'done', startAt: iso(2), endAt: iso(2), deviceId: 'D1', companyId: 'C1' },
    { id: 'PK-D2', status: 'done', startAt: iso(2), endAt: iso(2), deviceId: 'D2', companyId: 'C1' },
    { id: 'PK1', status: 'ongoing', startAt: new Date(Date.now() - 9 * 36e5).toISOString(), driverId: 'DR', vehicleId: 'V1', deviceId: 'D3', locationId: 'L1' },
    { id: 'PK2', status: 'done', startAt: iso(1), endAt: iso(1), volume: 4800, flags: ['nolocation', 'capacity'], deviceId: 'D3', vehicleId: 'V1', driverId: 'DR' },
  ],
  reportedIssues: [{ id: 'RI1', deviceId: 'D1', category: 'no_access', description: 'Gate locked', at: iso(2), status: 'open', reportedBy: 'Dylan' }],
  alertNotes: [], alertReads: [],
} as unknown as AppData)

test('alert ids match the web console hash', () => {
  expect(alertIdOf('od:D1:2026-01-01')).toMatch(/^AL-[0-9A-Z]{7}$/)
  expect(alertIdOf('x')).toBe(alertIdOf('x'))
  expect(alertIdOf('x')).not.toBe(alertIdOf('y'))
})

test('derives the device, driver and vehicle alerts', () => {
  const list = deriveAlerts(base())
  const types = list.map((a) => a.type).sort()
  expect(types).toEqual(['capacity', 'longJob', 'nolocation', 'overdue', 'overdue', 'reportedIssue', 'vehicleFull'])
  const od = list.filter((a) => a.type === 'overdue')
  expect(od.find((a) => a.refs.deviceId === 'D1')!.severity).toBe('critical')
  expect(od.find((a) => a.refs.deviceId === 'D2')!.severity).toBe('warning')
  expect(list.find((a) => a.type === 'longJob')!.to).toBe('/job/PK1')
  expect(list.find((a) => a.type === 'vehicleFull')!.title).toContain('96% full')
})

test('overdue attribution uses latest completed service, not stored assignment or ongoing work', () => {
  const d = base()
  d.pickups.push({ id: 'PK-new', status: 'done', deviceId: 'D1', companyId: 'C2', startAt: iso(1), endAt: iso(1) },
    { id: 'PK-open', status: 'ongoing', deviceId: 'D2', companyId: 'C2', startAt: iso(0) })
  const alerts = deriveAlerts(d)
  expect(alerts.find((a) => a.type === 'overdue' && a.refs.deviceId === 'D1')?.refs.companyId).toBe('C2')
  expect(alerts.find((a) => a.type === 'overdue' && a.refs.deviceId === 'D2')?.refs.companyId).toBe('C1')
  d.pickups = d.pickups.filter((p) => p.deviceId !== 'D2')
  expect(deriveAlerts(d).find((a) => a.type === 'overdue' && a.refs.deviceId === 'D2')?.refs.companyId).toBeNull()
})

test('backlog alert appears from three overdue devices per company', () => {
  const d = base()
  d.devices.push({ id: 'D4', ref: 'DV4', status: 'Active', freqWeeks: 4, lastService: iso(40), locationId: 'L1', companyId: 'C1' })
  d.pickups.push({ id: 'PK-D4', status: 'done', startAt: iso(2), endAt: iso(2), deviceId: 'D4', companyId: 'C1' })
  expect(deriveAlerts(d).some((a) => a.type === 'transportBacklog')).toBe(true)
})

test('status and read flags come from alertNotes and alertReads', () => {
  const d = base()
  const [first] = alertViews(d)
  d.alertNotes.push({ id: 'AN0001', alertId: first.id, kind: 'status', status: 'acknowledged', at: iso(1) }, { id: 'AN0002', alertId: first.id, kind: 'status', status: 'cleared', at: iso(0) })
  d.alertReads.push({ id: first.id })
  expect(statusMap(d).get(first.id)).toBe('cleared')
  const views = alertViews(d)
  const v = views.find((a) => a.id === first.id)!
  expect(v.status).toBe('cleared')
  expect(v.read).toBe(true)
  const c = alertCounts(views)
  expect(c.active).toBe(views.length - 1)
  expect(c.unread).toBe(views.length - 1)
})
