import type { SyncPayload } from './api'
import { LOCATION_FLAG_METRES } from './config'
import { normName } from './format'
import { distanceM } from './geo-math'
import { PREFIX, nextId } from './ids'
import { ISSUE_CATEGORIES } from './issues'
import type { AppData, ChangeLog, Coords, Device, IssueCategory, Pickup, PickupFlag, ReportedIssue, WorkProfile } from './types'
import { DEFAULT_WASTE } from './waste'

// Every write is a command: plain data describing what the driver did and when. planCommand() turns it into a
// /sync payload against a given copy of the server state, so the same command can be applied online right away
// or later from the offline queue. `at` is captured when the driver acts, not when the command is sent.
export type Command =
  | { kind: 'startPickup'; at: string; deviceId: string; profile: WorkProfile; coords: Coords | null }
  | { kind: 'finishPickup'; at: string; pickupId: string; volume: number; note: string; coords: Coords | null; userName: string; waste?: string }
  | { kind: 'cancelPickup'; at: string; pickupId: string }
  // Old WasteID "Service Device": the device was serviced but no waste was collected.
  | { kind: 'serviceOnly'; at: string; deviceId: string; profile: WorkProfile; coords: Coords | null; note: string; userName: string }
  // Old WasteID "Report Issue / Service Problem", reviewed and resolved in the web console.
  | { kind: 'reportIssue'; at: string; deviceId: string; category: IssueCategory; description: string; userName: string }

// A rule the current server state does not allow; the message is shown to the driver as is.
export class CommandError extends Error {}

export interface Plan { sync: SyncPayload | null; result: unknown }

export const SERVICE_ONLY_WASTE = 'Service only'

const isoDate = (s?: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '')

// Servicing a device moves its last service date to `at` and leaves an audit entry, as the web console does.
function serviceDevice(seq: Record<string, number>, dev: Device, at: string, userName: string) {
  // changeLogs are not part of the app's state, so the id comes from seq alone.
  const cl = nextId({ seq }, PREFIX.changeLog, [])
  const log: ChangeLog = {
    id: cl.id, deviceId: dev.id, entityType: 'device', entityId: dev.id, field: 'Last service',
    oldValue: isoDate(dev.lastService), newValue: isoDate(at), user: userName, source: 'App', at,
  }
  return { device: { ...dev, lastService: at }, log, seq: cl.seq }
}

function locationFlags(distance: number | null, coords: Coords | null) {
  const flags: PickupFlag[] = []
  if (distance != null && distance > LOCATION_FLAG_METRES) flags.push('location')
  if (!coords) flags.push('nolocation')
  return flags
}

function readyToWork(d: AppData, deviceId: string, profile: WorkProfile) {
  const dev = d.devices.find((x) => x.id === deviceId)
  if (!dev) throw new CommandError('This device no longer exists.')
  if (d.pickups.some((p) => p.status === 'ongoing' && p.deviceId === deviceId)) {
    throw new CommandError('A pickup is already in progress at this device.')
  }
  if (d.pickups.some((p) => p.status === 'ongoing' && p.driverId === profile.driverId)) {
    throw new CommandError('You already have a pickup in progress. Finish it before starting another.')
  }
  return dev
}

export function planStartPickup(d: AppData, c: Extract<Command, { kind: 'startPickup' }>) {
  const dev = readyToWork(d, c.deviceId, c.profile)
  const { id, seq } = nextId(d, PREFIX.pickup, d.pickups)
  const pickup: Pickup = {
    id, deviceId: dev.id, locationId: dev.locationId ?? null,
    companyId: c.profile.companyId, driverId: c.profile.driverId, vehicleId: c.profile.vehicleId,
    volume: null, waste: normName(dev.waste) || DEFAULT_WASTE, startAt: c.at, endAt: null,
    startLat: c.coords?.lat ?? null, startLng: c.coords?.lng ?? null, endLat: null, endLng: null,
    distance: distanceM(dev.lat, dev.lng, c.coords?.lat, c.coords?.lng), photos: 0, flags: [], note: '', status: 'ongoing',
  }
  return { sync: { upserts: { pickups: [pickup] }, seq }, result: pickup }
}

export function planFinishPickup(d: AppData, c: Extract<Command, { kind: 'finishPickup' }>) {
  const p = d.pickups.find((x) => x.id === c.pickupId)
  if (!p) throw new CommandError('This pickup was removed by someone else.')
  if (p.status !== 'ongoing') throw new CommandError('This pickup has already been completed.')
  const dev = d.devices.find((x) => x.id === p.deviceId)
  const distance = distanceM(dev?.lat, dev?.lng, c.coords?.lat, c.coords?.lng)
  const flags = locationFlags(distance, c.coords)
  if (dev?.capacity && c.volume > dev.capacity) flags.push('capacity')
  const done: Pickup = {
    ...p, volume: c.volume, note: c.note.trim(), endAt: c.at, waste: normName(c.waste) || p.waste,
    endLat: c.coords?.lat ?? null, endLng: c.coords?.lng ?? null, distance: distance ?? p.distance ?? null, flags, status: 'done',
  }
  const upserts: Record<string, unknown[]> = { pickups: [done] }
  let seq = d.seq
  if (dev) {
    const sv = serviceDevice(seq, dev, c.at, c.userName)
    seq = sv.seq
    upserts.devices = [sv.device]
    upserts.changeLogs = [sv.log]
  }
  return { sync: { upserts, seq }, result: done }
}

export function planServiceOnly(d: AppData, c: Extract<Command, { kind: 'serviceOnly' }>) {
  const dev = readyToWork(d, c.deviceId, c.profile)
  const pk = nextId(d, PREFIX.pickup, d.pickups)
  const distance = distanceM(dev.lat, dev.lng, c.coords?.lat, c.coords?.lng)
  const lat = c.coords?.lat ?? null, lng = c.coords?.lng ?? null
  const done: Pickup = {
    id: pk.id, deviceId: dev.id, locationId: dev.locationId ?? null,
    companyId: c.profile.companyId, driverId: c.profile.driverId, vehicleId: c.profile.vehicleId,
    volume: 0, waste: SERVICE_ONLY_WASTE, startAt: c.at, endAt: c.at,
    startLat: lat, startLng: lng, endLat: lat, endLng: lng,
    distance, photos: 0, flags: locationFlags(distance, c.coords), note: c.note.trim(), status: 'done',
  }
  const sv = serviceDevice(pk.seq, dev, c.at, c.userName)
  return { sync: { upserts: { pickups: [done], devices: [sv.device], changeLogs: [sv.log] }, seq: sv.seq }, result: done }
}

export function planCancelPickup(d: AppData, c: Extract<Command, { kind: 'cancelPickup' }>) {
  const p = d.pickups.find((x) => x.id === c.pickupId)
  if (!p || p.status !== 'ongoing') return { sync: null, result: null }
  return { sync: { upserts: {}, deletes: { pickups: [c.pickupId] }, seq: d.seq }, result: null }
}

export function planReportIssue(d: AppData, c: Extract<Command, { kind: 'reportIssue' }>) {
  if (!d.devices.some((x) => x.id === c.deviceId)) throw new CommandError('This device no longer exists.')
  if (!(c.category in ISSUE_CATEGORIES)) throw new CommandError('Choose what the problem is.')
  const description = c.description.trim()
  if (c.category === 'other' && !description) throw new CommandError('Describe the problem.')
  const { id, seq } = nextId(d, PREFIX.issue, d.reportedIssues)
  const issue: ReportedIssue = {
    id, deviceId: c.deviceId, category: c.category, description: description || null,
    reportedBy: c.userName, at: c.at, status: 'open', source: 'App',
  }
  return { sync: { upserts: { reportedIssues: [issue] }, seq }, result: issue }
}

export function planCommand(d: AppData, c: Command): Plan {
  switch (c.kind) {
    case 'startPickup': return planStartPickup(d, c)
    case 'finishPickup': return planFinishPickup(d, c)
    case 'cancelPickup': return planCancelPickup(d, c)
    case 'serviceOnly': return planServiceOnly(d, c)
    case 'reportIssue': return planReportIssue(d, c)
  }
}
