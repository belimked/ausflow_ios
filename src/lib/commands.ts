import type { SyncPayload } from './api'
import { LOCATION_FLAG_METRES } from './config'
import { normName } from './format'
import { distanceM } from './geo-math'
import { PREFIX, nextId } from './ids'
import type { AppData, ChangeLog, Coords, Pickup, PickupFlag, WorkProfile } from './types'
import { DEFAULT_WASTE } from './waste'

// Every write is a command: plain data describing what the driver did and when. planCommand() turns it into a
// /sync payload against a given copy of the server state, so the same command can be applied online right away
// or later from the offline queue. `at` is captured when the driver acts, not when the command is sent.
export type Command =
  | { kind: 'startPickup'; at: string; deviceId: string; profile: WorkProfile; coords: Coords | null }
  | { kind: 'finishPickup'; at: string; pickupId: string; volume: number; note: string; coords: Coords | null; userName: string }
  | { kind: 'cancelPickup'; at: string; pickupId: string }

// A rule the current server state does not allow; the message is shown to the driver as is.
export class CommandError extends Error {}

export interface Plan { sync: SyncPayload | null; result: unknown }

const isoDate = (s?: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '')

export function planStartPickup(d: AppData, c: Extract<Command, { kind: 'startPickup' }>) {
  const dev = d.devices.find((x) => x.id === c.deviceId)
  if (!dev) throw new CommandError('This device no longer exists.')
  if (d.pickups.some((p) => p.status === 'ongoing' && p.deviceId === c.deviceId)) {
    throw new CommandError('A pickup is already in progress at this device.')
  }
  if (d.pickups.some((p) => p.status === 'ongoing' && p.driverId === c.profile.driverId)) {
    throw new CommandError('You already have a pickup in progress. Finish it before starting another.')
  }
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
  const flags: PickupFlag[] = []
  if (distance != null && distance > LOCATION_FLAG_METRES) flags.push('location')
  if (!c.coords) flags.push('nolocation')
  if (dev?.capacity && c.volume > dev.capacity) flags.push('capacity')
  const done: Pickup = {
    ...p, volume: c.volume, note: c.note.trim(), endAt: c.at,
    endLat: c.coords?.lat ?? null, endLng: c.coords?.lng ?? null, distance: distance ?? p.distance ?? null, flags, status: 'done',
  }
  const upserts: Record<string, unknown[]> = { pickups: [done] }
  let seq = d.seq
  if (dev) {
    // changeLogs are not part of the app's state, so the id comes from seq alone.
    const cl = nextId(d, PREFIX.changeLog, [])
    seq = cl.seq
    const log: ChangeLog = {
      id: cl.id, deviceId: dev.id, entityType: 'device', entityId: dev.id, field: 'Last service',
      oldValue: isoDate(dev.lastService), newValue: isoDate(c.at), user: c.userName, source: 'App', at: c.at,
    }
    upserts.devices = [{ ...dev, lastService: c.at }]
    upserts.changeLogs = [log]
  }
  return { sync: { upserts, seq }, result: done }
}

export function planCancelPickup(d: AppData, c: Extract<Command, { kind: 'cancelPickup' }>) {
  const p = d.pickups.find((x) => x.id === c.pickupId)
  if (!p || p.status !== 'ongoing') return { sync: null, result: null }
  return { sync: { upserts: {}, deletes: { pickups: [c.pickupId] }, seq: d.seq }, result: null }
}

export function planCommand(d: AppData, c: Command): Plan {
  switch (c.kind) {
    case 'startPickup': return planStartPickup(d, c)
    case 'finishPickup': return planFinishPickup(d, c)
    case 'cancelPickup': return planCancelPickup(d, c)
  }
}
