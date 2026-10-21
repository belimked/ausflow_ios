import { ApiError, type SyncPayload } from './api'
import { CommandError, planCommand, type Command } from './commands'
import {
  alreadyApplied, applyPayload, createsRecord, dependsOn, isLocalId, newLocalId, planLocally, remapItem,
  type QueuedPhoto, type QueueItem, type SyncProblem,
} from './offline/queue'
import type { AppData } from './types'

export interface PhotoTarget { type: string; kind: string }
export interface NewPhoto { dataUrl: string; name: string }

export interface OutboxDeps {
  // Latest server state. Throws ApiError with status 0 when the server cannot be reached.
  fresh: () => Promise<AppData>
  send: (payload: SyncPayload) => Promise<unknown>
  reload: () => Promise<unknown>
  // What the driver currently sees (server data + queue), or null when nothing was ever loaded.
  local: () => AppData | null
  getQueue: () => QueueItem[]
  setQueue: (items: QueueItem[]) => void
  addProblems: (problems: SyncProblem[]) => void
  savePhoto: (photo: NewPhoto) => QueuedPhoto
  uploadPhoto: (target: PhotoTarget, id: string, photo: QueuedPhoto) => Promise<unknown>
  dropPhoto: (photo: QueuedPhoto) => void
  now: () => string
  // A temporary id now has its real id (screens showing the temporary record can follow it).
  onSent?: (localId: string, realId: string) => void
}

export const isOffline = (e: unknown) => e instanceof ApiError && e.status === 0
// Try again later instead of giving up on the item: no network, signed out, or a server fault.
const isTransient = (e: unknown) => e instanceof ApiError && (e.status === 0 || e.status === 401 || e.status >= 500)

const newKey = () => newLocalId().replace('local-', 'q-')

// `sentResult` is set when the command was already planned against server data and may even have arrived there;
// the phone's copy must not refuse it then (it may already contain the record).
function enqueue<T>(deps: OutboxDeps, cmd: Command, photos?: { target: PhotoTarget; files: NewPhoto[] }, sentResult?: unknown) {
  const view = deps.local()
  if (!view) throw new CommandError('There is no data on this phone yet. Connect to the internet and try again.')
  const localId = createsRecord(cmd) ? newLocalId() : undefined
  let result: unknown
  try {
    // Same rules as online, checked against what the phone knows.
    result = planLocally(view, cmd, localId).result
  } catch (e) {
    if (!(e instanceof CommandError) || sentResult === undefined) throw e
    result = localId && sentResult ? { ...(sentResult as object), id: localId } : sentResult
  }
  const items: QueueItem[] = [{ key: newKey(), cmd, localId }]
  if (localId && photos?.files.length) {
    items.push({ key: newKey(), entityId: localId, photos: { target: photos.target, files: photos.files.map(deps.savePhoto) } })
  }
  deps.setQueue([...deps.getQueue(), ...items])
  return { result: result as T, queued: true }
}

// Send a command now if possible, otherwise queue it. Rule violations (CommandError) are thrown either way.
// Photos for the created record are always queued and go out with the next flush.
export async function submit<T>(deps: OutboxDeps, cmd: Command, photos?: { target: PhotoTarget; files: NewPhoto[] }): Promise<{ result: T; queued: boolean }> {
  // Anything already waiting must reach the server first, in order.
  if (deps.getQueue().length) return enqueue<T>(deps, cmd, photos)
  let d: AppData
  try {
    d = await deps.fresh()
  } catch (e) {
    if (isOffline(e)) return enqueue<T>(deps, cmd, photos)
    throw e
  }
  const plan = planCommand(d, cmd)
  if (plan.sync) {
    try {
      await deps.send(plan.sync)
    } catch (e) {
      // The request may still have arrived; flush() recognises an applied command and does not repeat it.
      if (isOffline(e)) return enqueue<T>(deps, cmd, photos, plan.result)
      throw e
    }
    await deps.reload().catch(() => {})
  }
  const id = createsRecord(cmd) ? (plan.result as { id: string }).id : undefined
  if (id && photos?.files.length) {
    deps.setQueue([...deps.getQueue(), { key: newKey(), entityId: id, photos: { target: photos.target, files: photos.files.map(deps.savePhoto) } }])
  }
  return { result: plan.result as T, queued: false }
}

// Send the queue in order. Stops (keeping the rest) when the server cannot be reached; an item the server refuses
// becomes a sync problem, together with any queued item that depends on the record it would have created.
export async function flush(deps: OutboxDeps): Promise<{ sent: number; stopped: boolean }> {
  let sent = 0
  let d: AppData | null = null
  for (;;) {
    const [item, ...rest] = deps.getQueue()
    if (!item) break
    try {
      if (item.cmd) {
        // One download of /state per flush; our own changes are applied on top as they go out.
        d = d || (await deps.fresh())
        let realId = alreadyApplied(d, item.cmd)
        if (realId === null) {
          const plan = planCommand(d, item.cmd)
          if (plan.sync) {
            await deps.send(plan.sync)
            d = applyPayload(d, plan.sync)
          }
          realId = createsRecord(item.cmd) ? (plan.result as { id: string }).id : ''
        }
        const real = realId
        deps.setQueue(item.localId && real ? rest.map((i) => remapItem(i, item.localId!, real)) : rest)
        if (item.localId && real) deps.onSent?.(item.localId, real)
      } else if (item.photos && item.entityId) {
        if (isLocalId(item.entityId)) throw new CommandError('The record these photos belong to was not sent.')
        let files = item.photos.files
        while (files.length) {
          await deps.uploadPhoto(item.photos.target, item.entityId, files[0])
          deps.dropPhoto(files[0])
          files = files.slice(1)
          // Remember progress so a retry does not upload the same photo twice.
          deps.setQueue([{ ...item, photos: { ...item.photos, files } }, ...rest])
        }
        deps.setQueue(rest)
      } else {
        deps.setQueue(rest)
      }
      sent++
    } catch (e) {
      if (isTransient(e)) {
        if (sent) await deps.reload().catch(() => {})
        return { sent, stopped: true }
      }
      const reason = e instanceof Error ? e.message : String(e)
      const dependents = item.localId ? rest.filter((i) => dependsOn(i, item.localId!)) : []
      deps.setQueue(rest.filter((i) => !dependents.includes(i)))
      const at = deps.now()
      deps.addProblems([
        { item, reason, at },
        ...dependents.map((i) => ({ item: i, reason: `Depends on a record that could not be sent: ${reason}`, at })),
      ])
    }
  }
  if (sent) await deps.reload().catch(() => {})
  return { sent, stopped: false }
}
