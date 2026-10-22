import type { SyncPayload } from '../api'
import { CommandError, planCommand, type Command } from '../commands'
import type { AppData } from '../types'

// Offline queue. A command that cannot reach the server is kept here, in order, and shown to the driver right away
// by applying it to the local copy of the data. Records it creates get a temporary "local-…" id; when the command
// is finally sent it is planned again against fresh server state, which gives the real id, and later commands that
// referred to the temporary id are rewritten.

export interface QueuedPhoto { file: string; name: string }

export interface QueueItem {
  key: string
  // Absent for a photos-only item: the record exists, its photos still have to be uploaded.
  cmd?: Command
  // Temporary id of the record this command creates, if any.
  localId?: string
  // Record the photos belong to (photos-only items); may still be a temporary id.
  entityId?: string
  // Photos to upload once the record has its real id (stored as files, see storage.ts).
  photos?: { target: { type: string; kind: string }; files: QueuedPhoto[] }
}

export interface SyncProblem { item: QueueItem; reason: string; at: string }

export const isLocalId = (id?: string | null) => !!id && id.startsWith('local-')

export const newLocalId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const CREATES: Partial<Record<Command['kind'], keyof AppData>> = {
  startPickup: 'pickups', serviceOnly: 'pickups', reportIssue: 'reportedIssues', unload: 'unloads', transfer: 'transfers',
}
export const createsRecord = (cmd: Command) => !!CREATES[cmd.kind]

// Rewrite temporary ids the command refers to. Returns null when it refers to a temporary id that never got a real
// one (the command that created it failed), so this command cannot be sent either.
export function remapCommand(cmd: Command, idMap: Record<string, string>): Command | null {
  if (cmd.kind === 'finishPickup' || cmd.kind === 'cancelPickup') {
    if (!isLocalId(cmd.pickupId)) return cmd
    const real = idMap[cmd.pickupId]
    return real ? { ...cmd, pickupId: real } : null
  }
  return cmd
}

// Replace a temporary id with the real one in a queued item.
export function remapItem(item: QueueItem, localId: string, realId: string): QueueItem {
  const map = { [localId]: realId }
  return {
    ...item,
    cmd: item.cmd ? remapCommand(item.cmd, map) || item.cmd : undefined,
    entityId: item.entityId === localId ? realId : item.entityId,
  }
}

// The item refers to a record that only exists under this temporary id.
export const dependsOn = (item: QueueItem, localId: string) =>
  item.entityId === localId || ((item.cmd?.kind === 'finishPickup' || item.cmd?.kind === 'cancelPickup') && item.cmd.pickupId === localId)

// The request may have reached the server even though the phone never saw the answer. Commands carry the moment the
// driver acted, which is stored on the record, so a record with the same key facts means it was already applied.
// Returns the id of that record ('' for commands that create nothing), or null if it has not been applied.
export function alreadyApplied(d: AppData, cmd: Command): string | null {
  switch (cmd.kind) {
    case 'startPickup':
      return d.pickups.find((p) => p.deviceId === cmd.deviceId && p.driverId === cmd.profile.driverId && p.startAt === cmd.at)?.id ?? null
    case 'serviceOnly':
      return d.pickups.find((p) => p.deviceId === cmd.deviceId && p.driverId === cmd.profile.driverId && p.startAt === cmd.at && p.endAt === cmd.at)?.id ?? null
    case 'finishPickup':
      return d.pickups.some((p) => p.id === cmd.pickupId && p.status === 'done' && p.endAt === cmd.at) ? '' : null
    case 'cancelPickup':
      return null
    case 'reportIssue':
      return d.reportedIssues.find((i) => i.deviceId === cmd.deviceId && i.at === cmd.at && i.reportedBy === cmd.userName)?.id ?? null
    case 'unload':
      return d.unloads.find((u) => u.vehicleId === cmd.profile.vehicleId && u.at === cmd.at)?.id ?? null
    case 'transfer':
      return d.transfers.find((t) => t.fromVehicleId === cmd.profile.vehicleId && t.toVehicleId === cmd.toVehicleId && t.at === cmd.at)?.id ?? null
  }
}

// Apply a planned /sync payload to a copy of the data, the way the server would.
export function applyPayload(d: AppData, p: SyncPayload): AppData {
  const out: AppData = { ...d, seq: { ...d.seq } }
  for (const [k, v] of Object.entries(p.seq || {})) out.seq[k] = Math.max(out.seq[k] || 0, v)
  const tables = out as unknown as Record<string, { id: string }[]>
  for (const [table, ids] of Object.entries(p.deletes || {})) {
    if (Array.isArray(tables[table])) tables[table] = tables[table].filter((r) => !ids.includes(r.id))
  }
  for (const [table, rows] of Object.entries(p.upserts || {})) {
    if (!Array.isArray(tables[table])) continue
    const next = [...tables[table]]
    for (const row of rows as { id: string }[]) {
      const i = next.findIndex((r) => r.id === row.id)
      if (i >= 0) next[i] = { ...next[i], ...row }
      else next.unshift(row)
    }
    tables[table] = next
  }
  return out
}

// Plan a command against the local view and give a created record its temporary id.
export function planLocally(d: AppData, cmd: Command, localId?: string) {
  const plan = planCommand(d, cmd)
  if (!plan.sync) return { view: d, result: plan.result }
  const planned = (plan.result as { id?: string } | null)?.id
  const sync = localId && planned ? withLocalId(plan.sync, cmd, planned, localId) : plan.sync
  const result = localId && plan.result ? { ...(plan.result as object), id: localId } : plan.result
  return { view: applyPayload(d, sync), result }
}

// What the driver sees: server data plus everything still waiting in the queue. A queued command that no longer
// fits (the server data changed underneath it) is left out here and reported when the queue is sent.
export function localView(d: AppData, items: QueueItem[]) {
  let view = d
  for (const item of items) {
    if (!item.cmd) continue
    try {
      view = planLocally(view, item.cmd, item.localId).view
    } catch (e) {
      if (!(e instanceof CommandError)) throw e
    }
  }
  return view
}

// Swap the id the planner chose for the item's temporary id, so the local view and later commands agree.
export function withLocalId(p: SyncPayload, cmd: Command, plannedId: string, localId: string): SyncPayload {
  const table = CREATES[cmd.kind]
  if (!table) return p
  const rows = (p.upserts[table] || []).map((r) => ((r as { id: string }).id === plannedId ? { ...(r as object), id: localId } : r))
  return { ...p, upserts: { ...p.upserts, [table]: rows } }
}
