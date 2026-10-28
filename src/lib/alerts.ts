import { beginOf, legDuration, legsOf, workDays, type DayEvent } from './admin'
import { dueState, fmtL, fmtM, nextService } from './format'
import { distanceM } from './geo-math'
import { vehicleLoads } from './load'
import { lastServiceCompanies } from './servicedBy'
import type { AlertStatus, AppData, Device } from './types'

// Alerts are derived from the data, not stored: the same rules as the web console (store/alerts.js), so the
// phone and the console show the same list. The id is a hash of the alert's business key, so a status set on
// one side (alertNotes) applies on the other. Rules ported: the device, driver and vehicle families; the
// "suspicious activity" family (overload, unload over tank, waste mismatch…) stays console-only for now.

export type AlertType = 'overdue' | 'longJob' | 'location' | 'capacity' | 'nolocation' | 'vehicleFull' | 'reportedIssue' | 'transportBacklog' | 'fastLeg'
export type Severity = 'critical' | 'warning' | 'info'
export type AlertCategory = 'device' | 'vehicle' | 'driver' | 'suspicious'

export const ALERT_TYPES: Record<AlertType, string> = {
  overdue: 'Overdue pump-out', longJob: 'Job not finished', location: 'Location mismatch', capacity: 'Over capacity',
  nolocation: 'No location', vehicleFull: 'Vehicle near full', reportedIssue: 'Reported issue', transportBacklog: 'Transport backlog', fastLeg: 'Impossibly fast leg',
}
const TYPE_CATEGORY: Record<AlertType, AlertCategory> = {
  overdue: 'device', capacity: 'device', reportedIssue: 'device', vehicleFull: 'vehicle', transportBacklog: 'vehicle',
  longJob: 'driver', location: 'driver', nolocation: 'driver', fastLeg: 'suspicious',
}
export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', warning: 'Warning', info: 'Info' }
export const STATUS_LABEL: Record<AlertStatus, string> = { new: 'New', acknowledged: 'Acknowledged', cleared: 'Cleared', dismissed: 'Dismissed' }

export const REMIND_HOURS = 8
export const BACKLOG_WARN = 3
export const BACKLOG_CRITICAL = 10
const RECENT_DAYS = 14
const DAY = 864e5

export interface AlertRefs { deviceId?: string | null; locationId?: string | null; companyId?: string | null; vehicleId?: string | null; driverId?: string | null; pickupId?: string | null; issueId?: string | null }
export interface Alert {
  id: string; type: AlertType; category: AlertCategory; severity: Severity
  title: string; detail: string; at: string | null
  // Where "Open" goes in the app.
  to: string
  refs: AlertRefs
}

// FNV-1a over the key, base-36, 'AL-' prefix; identical to the web console's alertIdOf.
export function alertIdOf(key: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return 'AL-' + (h >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

const overdueDays = (d: Device) => { const s = dueState(d); return s.state === 'overdue' ? -s.days : 0 }
const overdueText = (d: Device) => { const days = overdueDays(d); return !days ? '' : days < 7 ? `${days} d overdue` : `${Math.floor(days / 7)} wk overdue` }

export function deriveAlerts(d: AppData, now = Date.now()): Alert[] {
  const out: Alert[] = []
  const name = <T extends { id: string }>(rows: T[], id?: string | null, pick: (r: T) => string = (r: any) => r.name) => {
    const r = id ? rows.find((x) => x.id === id) : undefined
    return r ? pick(r) : (id || '—')
  }
  const loc = (id?: string | null) => name(d.locations, id)
  const plate = (id?: string | null) => name(d.vehicles, id, (v) => v.plate)
  const driver = (id?: string | null) => name(d.drivers, id)
  const company = (id?: string | null) => name(d.companies, id)
  const devices = new Map(d.devices.map((x) => [x.id, x]))
  const push = (key: string, type: AlertType, a: Omit<Alert, 'id' | 'type' | 'category'>) => out.push({ id: alertIdOf(key), type, category: TYPE_CATEGORY[type], ...a })
  const kind = (e: DayEvent) => e.kind === 'pickup' ? 'Pump-out' : e.kind === 'transfer' ? 'Transfer' : 'Unload'

  for (const issue of d.reportedIssues) {
    if (issue.status !== 'open') continue
    const dev = devices.get(issue.deviceId)
    push('ri:' + issue.id, 'reportedIssue', { severity: 'warning', title: `${dev?.ref || issue.deviceId}: reported issue`, detail: issue.description || issue.category.replace(/_/g, ' '),
      at: issue.at, to: `/device/${issue.deviceId}`, refs: { deviceId: issue.deviceId, locationId: dev?.locationId, issueId: issue.id } })
  }

  const overdueByCompany = new Map<string, Device[]>()
  const servicedBy = lastServiceCompanies(d.pickups)
  for (const dev of d.devices) {
    const days = overdueDays(dev)
    if (!days) continue
    const companyId = servicedBy.get(dev.id)
    if (companyId) overdueByCompany.set(companyId, [...(overdueByCompany.get(companyId) || []), dev])
    push(`od:${dev.id}:${dev.lastService || ''}`, 'overdue', {
      severity: days >= 28 ? 'critical' : 'warning', title: `${dev.ref} overdue for pump-out`,
      detail: `${loc(dev.locationId)} · ${overdueText(dev)} · ${companyId ? company(companyId) : 'No previous service company'}`,
      at: nextService(dev), to: `/device/${dev.id}`, refs: { deviceId: dev.id, locationId: dev.locationId, companyId: companyId || null },
    })
  }

  for (const p of d.pickups) {
    const dev = p.deviceId ? devices.get(p.deviceId) : undefined
    const refs: AlertRefs = { pickupId: p.id, deviceId: p.deviceId, locationId: p.locationId, companyId: p.companyId, vehicleId: p.vehicleId, driverId: p.driverId }
    if (p.status === 'ongoing') {
      if (!p.startAt) continue
      const due = new Date(p.startAt).getTime() + REMIND_HOURS * 36e5
      if (due <= now) push('lj:' + p.id, 'longJob', {
        severity: 'critical', title: `Job ${p.id} still open after ${((now - new Date(p.startAt).getTime()) / 36e5).toFixed(1)} h`,
        detail: `${driver(p.driverId)} · ${plate(p.vehicleId)} · ${loc(p.locationId)}`, at: new Date(due).toISOString(), to: `/job/${p.id}`, refs,
      })
      continue
    }
    if (!p.endAt || now - new Date(p.endAt).getTime() > RECENT_DAYS * DAY) continue
    const flags = p.flags || []
    const who = `${driver(p.driverId)} · ${plate(p.vehicleId)}`
    const where = `${p.deviceId || ''} ${loc(p.locationId)} · ${who}`
    if (flags.includes('location')) push('lo:' + p.id, 'location', { severity: 'warning', title: `Pump-out ${p.id} recorded ${fmtM(p.distance)} from device`, detail: where, at: p.endAt, to: `/job/${p.id}`, refs })
    if (flags.includes('capacity')) push('ca:' + p.id, 'capacity', { severity: 'warning', title: `Pump-out ${p.id}: ${fmtL(p.volume)} exceeds device capacity ${fmtL(dev?.capacity)}`, detail: where, at: p.endAt, to: `/job/${p.id}`, refs })
    if (flags.includes('nolocation')) push('nl:' + p.id, 'nolocation', { severity: 'info', title: `Pump-out ${p.id} submitted without location`, detail: where, at: p.endAt, to: `/job/${p.id}`, refs })
  }

  for (const dr of d.drivers) {
    for (const day of workDays(d, { driverId: dr.id })) {
      for (const leg of legsOf(day.events, distanceM)) {
        if (!leg.fast || !leg.prev || leg.metres == null || leg.kmh == null || !leg.fromAt) continue
        const at = beginOf(leg.event)
        const time = new Date(at).getTime()
        if (!Number.isFinite(time) || time > now || now - time > RECENT_DAYS * DAY) continue
        const pickup = [leg.prev, leg.event].find((e) => e.kind === 'pickup')
        const vehicleId = leg.event.kind === 'pickup' ? leg.event.ref.vehicleId :
          leg.event.kind === 'unload' ? d.unloads.find((u) => u.id === leg.event.id)?.vehicleId :
            d.transfers.find((t) => t.id === leg.event.id)?.fromVehicleId
        push(`fl:${leg.prev.id}:${leg.event.id}`, 'fastLeg', {
          severity: leg.kmh > 200 ? 'critical' : 'warning',
          title: `${dr.name}: ${fmtM(leg.metres)} in ${legDuration(time - new Date(leg.fromAt).getTime())} (${Math.round(leg.kmh)} km/h)`,
          detail: `${kind(leg.prev)} ${leg.prev.id} → ${kind(leg.event)} ${leg.event.id} · ${plate(vehicleId)}`,
          at, to: `/driver/${dr.id}`, refs: { driverId: dr.id, vehicleId, pickupId: pickup?.id },
        })
      }
    }
  }

  for (const [companyId, list] of overdueByCompany) {
    if (list.length < BACKLOG_WARN) continue
    const oldest = list.reduce((a, b) => ((nextService(a) || '') < (nextService(b) || '') ? a : b))
    push('hb:' + companyId, 'transportBacklog', {
      severity: list.length >= BACKLOG_CRITICAL ? 'critical' : 'warning', title: `${company(companyId)} has ${list.length} overdue devices`,
      detail: `Oldest: ${oldest.ref} ${loc(oldest.locationId)} · ${overdueText(oldest)}`, at: nextService(oldest), to: `/company/${companyId}`, refs: { companyId },
    })
  }

  const loads = vehicleLoads(d)
  for (const v of d.vehicles) {
    const load = loads.get(v.id) || 0
    if ((v.status || '').toLowerCase() !== 'active' || !v.tank || load / v.tank < 0.9) continue
    const last = [...d.pickups.filter((p) => p.vehicleId === v.id && p.endAt).map((p) => p.endAt!), ...d.unloads.filter((u) => u.vehicleId === v.id).map((u) => u.at)].sort().pop() || null
    push('vf:' + v.id, 'vehicleFull', {
      severity: 'warning', title: `Vehicle ${v.plate} is ${Math.round((load / v.tank) * 100)}% full`,
      detail: `${company(v.companyId)} · ${fmtL(load)} / ${fmtL(v.tank)}`, at: last, to: `/vehicle/${v.id}`, refs: { vehicleId: v.id, companyId: v.companyId },
    })
  }
  return out
}

const LEGACY: Record<string, AlertStatus> = { open: 'new', progress: 'acknowledged', resolved: 'cleared' }

// Latest status entry per alert (alertNotes newest first on the console; here we sort by `at`).
export function statusMap(d: Pick<AppData, 'alertNotes'>) {
  const m = new Map<string, AlertStatus>()
  const rows = [...d.alertNotes].filter((n) => n.kind === 'status' && n.status).sort((a, b) => b.at.localeCompare(a.at))
  for (const n of rows) if (!m.has(n.alertId)) m.set(n.alertId, LEGACY[n.status!] || n.status!)
  return m
}
export const isActiveStatus = (s: AlertStatus) => s === 'new' || s === 'acknowledged'

export interface AlertView extends Alert { status: AlertStatus; read: boolean }

export function alertViews(d: AppData, now = Date.now()): AlertView[] {
  const st = statusMap(d)
  const reads = new Set(d.alertReads.map((r) => r.id))
  // Newest first, as on the web console's Alerts page; severity is a filter there, not the order.
  return deriveAlerts(d, now)
    .map((a) => ({ ...a, status: st.get(a.id) || 'new', read: reads.has(a.id) }))
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
}

export const notesOf = (d: Pick<AppData, 'alertNotes'>, alertId: string) => d.alertNotes.filter((n) => n.alertId === alertId).sort((a, b) => b.at.localeCompare(a.at))

export function alertCounts(list: AlertView[]) {
  const active = list.filter((a) => isActiveStatus(a.status))
  return { active: active.length, unread: active.filter((a) => !a.read).length, critical: active.filter((a) => a.severity === 'critical').length }
}
