import { dueState, nextService, startOfDay } from './format'
import type { AppData, Device, Pickup } from './types'

// Derived numbers for the console screens. Everything comes from the /state snapshot already on the phone,
// computed the same way as the web console's Dashboard so both show the same figures.

const DAY = 864e5

export type DueBucket = 'overdue' | 'soon' | 'ok' | 'none'

export interface DueBuckets { overdue: number; soon: number; ok: number; none: number; active: number }

export function dueBuckets(devices: Device[]): DueBuckets {
  const out: DueBuckets = { overdue: 0, soon: 0, ok: 0, none: 0, active: 0 }
  for (const d of devices) {
    if (d.status !== 'Active') continue
    out.active++
    const s = dueState(d).state
    if (s === 'overdue') out.overdue++
    else if (s === 'soon') out.soon++
    else if (s === 'ok') out.ok++
    else out.none++
  }
  return out
}

// Share of active devices that are not overdue, as the console's header chip shows it ("98.3%").
export function compliancePct(b: DueBuckets) {
  return b.active ? Math.round((100 - (b.overdue / b.active) * 100) * 10) / 10 : 100
}

export const isDone = (p: Pickup) => p.status === 'done' && !!p.endAt

export function donePickupsSince(pickups: Pickup[], days: number, now = Date.now()) {
  const from = startOfDay(new Date(now)) - (days - 1) * DAY
  return pickups.filter((p) => isDone(p) && new Date(p.endAt!).getTime() >= from)
}

export const litresOf = (pickups: Pickup[]) => pickups.reduce((n, p) => n + (p.volume || 0), 0)

// One bar per day, oldest first, for the dashboard's pump-out chart.
export function pickupsPerDay(pickups: Pickup[], days: number, now = Date.now()): { day: number; count: number; litres: number }[] {
  const today = startOfDay(new Date(now))
  const out = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, count: 0, litres: 0 }))
  for (const p of pickups) {
    if (!isDone(p)) continue
    const i = days - 1 - Math.floor((today - startOfDay(new Date(p.endAt!))) / DAY)
    if (i >= 0 && i < days) { out[i].count++; out[i].litres += p.volume || 0 }
  }
  return out
}

export interface CompanyOverdue { companyId: string; total: number; worstDays: number }

// Overdue active devices grouped by transport company, worst first (the console's ranking card).
export function overdueByCompany(devices: Device[]): CompanyOverdue[] {
  const m = new Map<string, CompanyOverdue>()
  for (const d of devices) {
    if (d.status !== 'Active') continue
    const s = dueState(d)
    if (s.state !== 'overdue') continue
    const key = d.companyId || ''
    const row = m.get(key) || { companyId: key, total: 0, worstDays: 0 }
    row.total++
    row.worstDays = Math.max(row.worstDays, -s.days)
    m.set(key, row)
  }
  return [...m.values()].sort((a, b) => b.total - a.total || b.worstDays - a.worstDays)
}

// Active devices sorted by how late they are, latest first; `unknown` (no schedule) last.
export function sortByDue(devices: Device[]) {
  return [...devices].sort((a, b) => (nextService(a) || '9').localeCompare(nextService(b) || '9'))
}

export type DeviceFilter = 'all' | 'overdue' | 'soon' | 'inactive'

export function filterDevices(devices: Device[], f: DeviceFilter) {
  if (f === 'inactive') return devices.filter((d) => d.status !== 'Active')
  const active = devices.filter((d) => d.status === 'Active')
  if (f === 'all') return active
  return active.filter((d) => dueState(d).state === f)
}

export function deviceCounts(devices: Device[]): Record<DeviceFilter, number> {
  const b = dueBuckets(devices)
  return { all: b.active, overdue: b.overdue, soon: b.soon, inactive: devices.length - b.active }
}

// Compact "last 14 days" summary for the dashboard header sentence.
export function dashboardSummary(d: AppData, now = Date.now()) {
  const b = dueBuckets(d.devices)
  const p7 = donePickupsSince(d.pickups, 7, now)
  const p7prev = d.pickups.filter((p) => {
    if (!isDone(p)) return false
    const t = new Date(p.endAt!).getTime()
    const from = startOfDay(new Date(now)) - 13 * DAY
    return t >= from && t < from + 7 * DAY
  })
  const flagged = d.pickups.filter((p) => isDone(p) && p.flags?.length && new Date(p.endAt!).getTime() >= now - 14 * DAY).length
  const ongoing = d.pickups.filter((p) => p.status === 'ongoing').length
  return {
    buckets: b, compliance: compliancePct(b),
    locations: d.locations.length, facilities: d.facilities.length, companies: d.companies.length,
    p7: p7.length, litres7: litresOf(p7), trend: p7prev.length ? Math.round(((p7.length - p7prev.length) / p7prev.length) * 100) : null,
    flagged, ongoing, openIssues: d.reportedIssues.filter((i) => i.status !== 'resolved').length,
  }
}
