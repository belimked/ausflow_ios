import type { AppData, Pickup, Transfer, Unload } from './types'

// Ported from the web console (web-prototype/src/store/db.js) so the app and the console agree on what is on board.
// Load = finished pickups + transfers in − transfers out − unloads. Prototype rule shared with the console:
// a transfer moves the whole load of the source vehicle, and an unload empties the vehicle.

type Events = Pick<AppData, 'pickups' | 'transfers' | 'unloads'>

const vol = (v?: number | null) => Number(v) || 0

export function vehicleLoads(d: Events) {
  const m = new Map<string, number>()
  const add = (id: string | null | undefined, v: number) => { if (id) m.set(id, (m.get(id) || 0) + v) }
  for (const p of d.pickups) if (p.status === 'done') add(p.vehicleId, vol(p.volume))
  for (const t of d.transfers) { add(t.fromVehicleId, -vol(t.volume)); add(t.toVehicleId, vol(t.volume)) }
  for (const u of d.unloads) add(u.vehicleId, -vol(u.volume))
  return m
}

export interface LoadCycle {
  vehicleId: string
  startAt: string
  endAt: string | null
  endKind: 'transfer' | 'unload' | null
  inflow: number
  pickups: Pickup[]
  transfersIn: Transfer[]
}

const ORDER = { pickup: 0, transferIn: 1, transfer: 2, unload: 3 } as const
type Ev =
  | { at: string; id: string; vehicleId: string; kind: 'pickup'; ref: Pickup }
  | { at: string; id: string; vehicleId: string; kind: 'transferIn' | 'transfer'; ref: Transfer }
  | { at: string; id: string; vehicleId: string; kind: 'unload'; ref: Unload }

// A cycle starts with the first inflow into an empty vehicle and ends at the next transfer out or unload.
export function vehicleCycles(d: Events) {
  const events: Ev[] = [
    ...d.pickups.filter((p) => p.status === 'done' && p.endAt && p.vehicleId)
      .map((p) => ({ at: p.endAt!, id: p.id, vehicleId: p.vehicleId!, kind: 'pickup' as const, ref: p })),
    ...d.transfers.flatMap((t) => [
      { at: t.at, id: t.id, vehicleId: t.fromVehicleId, kind: 'transfer' as const, ref: t },
      { at: t.at, id: t.id, vehicleId: t.toVehicleId, kind: 'transferIn' as const, ref: t },
    ]),
    ...d.unloads.map((u) => ({ at: u.at, id: u.id, vehicleId: u.vehicleId, kind: 'unload' as const, ref: u })),
  ]
  events.sort((a, b) => a.at.localeCompare(b.at) || ORDER[a.kind] - ORDER[b.kind] || a.id.localeCompare(b.id))
  const active = new Map<string, LoadCycle>()
  const cycles: LoadCycle[] = []
  for (const e of events) {
    let c = active.get(e.vehicleId)
    if (e.kind === 'pickup' || e.kind === 'transferIn') {
      if (!c) {
        c = { vehicleId: e.vehicleId, startAt: e.at, endAt: null, endKind: null, inflow: 0, pickups: [], transfersIn: [] }
        active.set(e.vehicleId, c)
        cycles.push(c)
      }
      c.inflow += vol(e.ref.volume)
      if (e.kind === 'pickup') c.pickups.push(e.ref)
      else c.transfersIn.push(e.ref)
    } else {
      if (c) { c.endAt = e.at; c.endKind = e.kind }
      active.delete(e.vehicleId)
    }
  }
  return cycles
}

// What is on board right now: the open cycle of the vehicle, if any.
export function currentCycle(d: Events, vehicleId: string) {
  return vehicleCycles(d).find((c) => c.vehicleId === vehicleId && c.endAt === null) || null
}

export type Hop =
  | { kind: 'pickup'; vehicleId: string; at: string; ref: Pickup }
  | { kind: 'transfer'; vehicleId: string; at: string; ref: Transfer }
  | { kind: 'unload'; vehicleId: string; at: string; ref: Unload }

// Follow a finished pickup forward through transfers until it reaches an unload.
export function traceForward(d: Pick<AppData, 'transfers' | 'unloads'>, pickup: Pickup) {
  const hops: Hop[] = [{ kind: 'pickup', vehicleId: pickup.vehicleId || '', at: pickup.endAt || '', ref: pickup }]
  let v = pickup.vehicleId || ''
  let t = pickup.endAt || ''
  for (let guard = 0; guard < 20; guard++) {
    const next = [
      ...d.transfers.filter((x) => x.fromVehicleId === v && x.at >= t).map((x) => ({ kind: 'transfer' as const, at: x.at, ref: x })),
      ...d.unloads.filter((u) => u.vehicleId === v && u.at >= t).map((u) => ({ kind: 'unload' as const, at: u.at, ref: u })),
    ].sort((a, b) => a.at.localeCompare(b.at))[0]
    if (!next) return { hops, finished: false }
    if (next.kind === 'unload') {
      hops.push({ kind: 'unload', vehicleId: v, at: next.at, ref: next.ref })
      return { hops, finished: true }
    }
    hops.push({ kind: 'transfer', vehicleId: next.ref.toVehicleId, at: next.at, ref: next.ref })
    v = next.ref.toVehicleId
    t = next.at
  }
  return { hops, finished: false }
}

export type DeliveryState = 'progress' | 'onboard' | 'delivered'

export function pickupDelivery(d: Pick<AppData, 'transfers' | 'unloads'>, p: Pickup) {
  if (p.status === 'ongoing') return { state: 'progress' as DeliveryState, vehicleId: p.vehicleId || null, unload: null, facilityId: null }
  const trace = traceForward(d, p)
  const last = trace.hops[trace.hops.length - 1]
  const unload = trace.finished && last.kind === 'unload' ? last.ref : null
  return { state: (unload ? 'delivered' : 'onboard') as DeliveryState, vehicleId: last.vehicleId || null, unload, facilityId: unload?.facilityId ?? null }
}
