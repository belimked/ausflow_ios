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

// ---- Driver and vehicle activity ---------------------------------------------------------------------

export type DayEvent =
  | { kind: 'pickup'; at: string; id: string; volume: number; lat?: number | null; lng?: number | null; ref: Pickup; flags: string[] }
  | { kind: 'unload'; at: string; id: string; volume: number; lat?: number | null; lng?: number | null; facilityId?: string | null }
  | { kind: 'transfer'; at: string; id: string; volume: number; lat?: number | null; lng?: number | null; out: boolean; otherVehicleId: string }

export interface Leg { event: DayEvent; fromAt: string | null; minutes: number | null; metres: number | null; slow: boolean }

export interface WorkDay { day: string; events: DayEvent[]; jobs: number; litres: number; firstAt: string; lastAt: string; minutes: number; flags: number }

// A leg with no event for this long is flagged "slow" (same idea as the web console's driver log).
export const SLOW_LEG_MINUTES = 120

type Activity = Pick<AppData, 'pickups' | 'transfers' | 'unloads'>

function eventsFor(d: Activity, match: { driverId?: string; vehicleId?: string }): DayEvent[] {
  const ok = (r: { driverId?: string | null; vehicleId?: string | null }) =>
    (match.driverId ? r.driverId === match.driverId : true) && (match.vehicleId ? r.vehicleId === match.vehicleId : true)
  const out: DayEvent[] = []
  for (const p of d.pickups) {
    if (!isDone(p) || !ok(p)) continue
    out.push({ kind: 'pickup', at: p.endAt!, id: p.id, volume: p.volume || 0, lat: p.endLat ?? p.startLat, lng: p.endLng ?? p.startLng, ref: p, flags: p.flags || [] })
  }
  for (const u of d.unloads) {
    if (!ok(u)) continue
    out.push({ kind: 'unload', at: u.at, id: u.id, volume: u.volume || 0, lat: u.lat, lng: u.lng, facilityId: u.facilityId })
  }
  for (const t of d.transfers) {
    const mine = match.vehicleId ? (t.fromVehicleId === match.vehicleId || t.toVehicleId === match.vehicleId) : ok(t)
    if (!mine) continue
    const out_ = match.vehicleId ? t.fromVehicleId === match.vehicleId : true
    out.push({ kind: 'transfer', at: t.at, id: t.id, volume: t.volume || 0, lat: t.lat, lng: t.lng, out: out_, otherVehicleId: out_ ? t.toVehicleId : t.fromVehicleId })
  }
  return out.sort((a, b) => beginOf(a).localeCompare(beginOf(b)))
}

// When an event began: a pickup at its start (its `at` is the end), everything else when it happened.
// Same order and leg timing as the web console's driver log.
export const beginOf = (e: DayEvent) => (e.kind === 'pickup' ? e.ref.startAt || e.at : e.at)

// The local calendar day (YYYY-MM-DD) of a timestamp. Timestamps are stored in UTC; slicing the ISO string would
// put an Adelaide afternoon on the next day and split one shift in two, so day counts drifted from the web console.
export function localDay(iso: string): string {
  const t = new Date(iso)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

// A pickup belongs to the day it was started on (as on the web console's driver page); other events to the day they happened.
const dayOf = (e: DayEvent) => localDay(beginOf(e))

// Working days, newest first: one row per calendar day with activity.
export function workDays(d: Activity, match: { driverId?: string; vehicleId?: string }): WorkDay[] {
  const byDay = new Map<string, DayEvent[]>()
  for (const e of eventsFor(d, match)) {
    const k = dayOf(e)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k)!.push(e)
  }
  return [...byDay.entries()].map(([day, events]) => {
    const pickups = events.filter((e) => e.kind === 'pickup') as Extract<DayEvent, { kind: 'pickup' }>[]
    const firstAt = beginOf(events[0])
    const lastAt = events[events.length - 1].at
    return {
      day, events, jobs: pickups.length, litres: pickups.reduce((n, p) => n + p.volume, 0), firstAt, lastAt,
      minutes: Math.max(0, Math.round((new Date(lastAt).getTime() - new Date(firstAt).getTime()) / 60000)),
      flags: pickups.filter((p) => p.flags.length).length,
    }
  }).sort((a, b) => b.day.localeCompare(a.day))
}

// The legs of one day: time and straight-line distance from the end of the previous event to the start of each
// event (the travel, not the pump-out itself). The first pickup's leg is its own duration.
export function legsOf(events: DayEvent[], distance: (a: DayEvent, b: DayEvent) => number | null): Leg[] {
  return events.map((e, i) => {
    const prev = i ? events[i - 1] : null
    const fromAt = prev ? prev.at : (e.kind === 'pickup' ? e.ref.startAt || null : null)
    const toAt = prev ? beginOf(e) : e.at
    const minutes = fromAt ? Math.max(0, Math.round((new Date(toAt).getTime() - new Date(fromAt).getTime()) / 60000)) : null
    return { event: e, fromAt, minutes, metres: prev ? distance(prev, e) : null, slow: minutes != null && minutes > SLOW_LEG_MINUTES }
  })
}

// Days with any activity in the last `days` days, for a company or the whole fleet.
export function activeDriverIds(d: Activity, days: number, now = Date.now()) {
  const from = startOfDay(new Date(now)) - (days - 1) * DAY
  const ids = new Set<string>()
  for (const p of d.pickups) if (p.driverId && (p.status === 'ongoing' || (isDone(p) && new Date(p.endAt!).getTime() >= from))) ids.add(p.driverId)
  return ids
}

// Company kinds, stored as a JSON array string (web console `companyTypes`); default transport.
export function companyTypes(c: { types?: string | string[] | null }): string[] {
  try { return Array.isArray(c.types) ? c.types : JSON.parse(c.types || '["transport"]') } catch { return ['transport'] }
}
export const isOccupier = (c: { types?: string | string[] | null }) => companyTypes(c).includes('occupier')
export const isTransport = (c: { types?: string | string[] | null }) => companyTypes(c).includes('transport')
