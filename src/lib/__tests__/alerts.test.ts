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

test('fast leg alerts use the shared key, severity, references and recent event start', () => {
  const d = base()
  const start = new Date(); start.setHours(12, 0, 0, 0)
  if (start.getTime() > Date.now()) start.setDate(start.getDate() - 1)
  const at = new Date(start.getTime() + 60000).toISOString()
  d.pickups = [{ id: 'PK-fast', status: 'done', driverId: 'DR', vehicleId: 'V1', startAt: start.toISOString(), endAt: start.toISOString(), endLat: 0, endLng: 0 }]
  d.unloads = [{ id: 'UL-fast', driverId: 'DR', vehicleId: 'V1', volume: 100, at, lat: 0, lng: 0.09 }]
  const fast = deriveAlerts(d).filter((a) => a.type === 'fastLeg')
  expect(fast).toHaveLength(1)
  expect(fast[0]).toMatchObject({ id: alertIdOf('fl:PK-fast:UL-fast'), category: 'driver', severity: 'critical',
    at, to: '/driver/DR', refs: { driverId: 'DR', vehicleId: 'V1', pickupId: 'PK-fast' } })
  expect(fast[0].title).toMatch(/Dylan: .* in 1 min \(\d+ km\/h\)/)
  expect(fast[0].detail).toBe('Pump-out PK-fast → Unload UL-fast · 122 4SZ')
  d.unloads[0].at = new Date(start.getTime() + 4 * 60000).toISOString()
  expect(deriveAlerts(d).find((a) => a.type === 'fastLeg')?.severity).toBe('warning')
  d.unloads[0].at = new Date(start.getTime() + 20 * 60000).toISOString()
  expect(deriveAlerts(d).filter((a) => a.type === 'fastLeg')).toHaveLength(0)
  d.unloads[0].at = new Date(Date.now() + DAY).toISOString()
  expect(deriveAlerts(d).filter((a) => a.type === 'fastLeg')).toHaveLength(0)
  d.pickups[0].startAt = d.pickups[0].endAt = iso(20)
  d.unloads[0].at = new Date(new Date(iso(20)).getTime() + 60000).toISOString()
  expect(deriveAlerts(d).filter((a) => a.type === 'fastLeg')).toHaveLength(0)
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
