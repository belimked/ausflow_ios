import { ApiError, type SyncPayload } from '../api'
import { CommandError } from '../commands'
import { applyPayload, localView, type QueueItem, type SyncProblem } from '../offline/queue'
import { flush, submit, type OutboxDeps } from '../outbox'
import type { AppData, Pickup, ReportedIssue } from '../types'
import { data, pickup, profile } from './fixtures'

const at = '2026-10-21T02:00:00.000Z'
const later = '2026-10-21T03:00:00.000Z'
const offline = () => new ApiError('Cannot reach the server.', 0)

// In-memory server and phone storage around the real outbox.
function setup(server: AppData = data()) {
  const s = {
    server, offline: false, expired: false,
    queue: [] as QueueItem[], problems: [] as SyncProblem[], sent: [] as SyncPayload[],
    uploads: [] as [string, string, string][], files: new Map<string, string>(), sentIds: {} as Record<string, string>,
    // Simulates a request that reaches the server but whose answer is lost.
    loseNextAnswer: false,
  }
  const guard = () => {
    if (s.offline) throw offline()
    if (s.expired) throw new ApiError('Session expired', 401)
  }
  const deps: OutboxDeps = {
    fresh: async () => { guard(); return s.server },
    send: async (p) => {
      guard()
      s.sent.push(p)
      s.server = applyPayload(s.server, p)
      if (s.loseNextAnswer) { s.loseNextAnswer = false; throw offline() }
    },
    reload: async () => { guard() },
    local: () => localView(s.server, s.queue),
    getQueue: () => s.queue,
    setQueue: (items) => { s.queue = items },
    addProblems: (ps) => { s.problems.push(...ps) },
    savePhoto: (p) => { const file = `f${s.files.size}`; s.files.set(file, p.dataUrl); return { file, name: p.name } },
    uploadPhoto: async (t, id, p) => { guard(); s.uploads.push([t.type, id, s.files.get(p.file)!]) },
    dropPhoto: (p) => { s.files.delete(p.file) },
    now: () => later,
    onSent: (localId, realId) => { s.sentIds[localId] = realId },
  }
  return { s, deps }
}

const start = (deviceId = 'DV0001') => ({ kind: 'startPickup' as const, at, deviceId, profile, coords: null })
const finish = (pickupId: string) => ({ kind: 'finishPickup' as const, at: later, pickupId, volume: 400, note: '', coords: null, userName: 'Sam' })

describe('submit online', () => {
  it('sends straight away', async () => {
    const { s, deps } = setup()
    const r = await submit<Pickup>(deps, start())
    expect(r).toMatchObject({ queued: false, result: { id: 'PK0001' } })
    expect(s.sent).toHaveLength(1)
    expect(s.queue).toEqual([])
  })

  it('still refuses commands that break a rule', async () => {
    const { s, deps } = setup(data({ devices: [] }))
    await expect(submit(deps, start())).rejects.toThrow(CommandError)
    expect(s.queue).toEqual([])
  })
})

describe('submit offline', () => {
  it('queues the command and shows it locally under a temporary id', async () => {
    const { s, deps } = setup()
    s.offline = true
    const r = await submit<Pickup>(deps, start())
    expect(r.queued).toBe(true)
    expect(r.result.id).toMatch(/^local-/)
    expect(s.sent).toEqual([])
    expect(deps.local()!.pickups.find((p) => p.id === r.result.id)).toMatchObject({ status: 'ongoing', deviceId: 'DV0001' })
  })

  it('checks the rules against what the phone knows', async () => {
    const { s, deps } = setup()
    s.offline = true
    await submit(deps, start())
    await expect(submit(deps, start())).rejects.toThrow('A pickup is already in progress at this device.')
    expect(s.queue).toHaveLength(1)
  })

  it('keeps the order: new commands wait behind queued ones even when online', async () => {
    const { s, deps } = setup()
    s.offline = true
    const p = (await submit<Pickup>(deps, start())).result
    s.offline = false
    const r = await submit(deps, finish(p.id))
    expect(r.queued).toBe(true)
    expect(s.sent).toEqual([])
  })
})

describe('flush', () => {
  it('sends queued work in order and replaces temporary ids with real ones', async () => {
    const { s, deps } = setup(data({ seq: { PK: 7 } }))
    s.offline = true
    const p = (await submit<Pickup>(deps, start())).result
    await submit(deps, finish(p.id))
    s.offline = false
    expect(await flush(deps)).toEqual({ sent: 2, stopped: false })
    expect(s.queue).toEqual([])
    expect(s.sentIds).toEqual({ [p.id]: 'PK0008' })
    expect(s.server.pickups).toEqual([expect.objectContaining({ id: 'PK0008', status: 'done', volume: 400, startAt: at, endAt: later })])
  })

  it('stops when the connection drops and keeps the rest', async () => {
    const { s, deps } = setup()
    s.offline = true
    await submit(deps, start('DV0001'))
    expect(await flush(deps)).toEqual({ sent: 0, stopped: true })
    expect(s.queue).toHaveLength(1)
  })

  it('pauses on an expired session instead of giving up', async () => {
    const { s, deps } = setup()
    s.offline = true
    await submit(deps, start())
    s.offline = false
    s.expired = true
    expect(await flush(deps)).toEqual({ sent: 0, stopped: true })
    expect(s.queue).toHaveLength(1)
    expect(s.problems).toEqual([])
  })

  it('turns a conflict into a sync problem, together with what depends on it', async () => {
    const { s, deps } = setup()
    s.offline = true
    const p = (await submit<Pickup>(deps, start())).result
    await submit(deps, finish(p.id))
    // Meanwhile another driver started a pickup at the same device.
    s.server = { ...s.server, pickups: [pickup({ id: 'PK0050', status: 'ongoing', driverId: 'DR0099' })] }
    s.offline = false
    expect(await flush(deps)).toEqual({ sent: 0, stopped: false })
    expect(s.queue).toEqual([])
    expect(s.problems.map((x) => x.reason)).toEqual([
      'A pickup is already in progress at this device.',
      'Depends on a record that could not be sent: A pickup is already in progress at this device.',
    ])
    expect(s.problems[0].item.cmd).toEqual(start())
  })

  it('does not send twice when the server got the request but the answer was lost', async () => {
    const { s, deps } = setup()
    s.loseNextAnswer = true
    const r = await submit<Pickup>(deps, start())
    expect(r.queued).toBe(true)
    expect(await flush(deps)).toEqual({ sent: 1, stopped: false })
    expect(s.sent).toHaveLength(1)
    expect(s.server.pickups).toHaveLength(1)
    expect(s.sentIds[r.result.id]).toBe('PK0001')
  })

  it('uploads queued photos against the real record id and deletes them from the phone', async () => {
    const { s, deps } = setup(data({ seq: { RI: 2 } }))
    s.offline = true
    const r = await submit<ReportedIssue>(deps, { kind: 'reportIssue', at, deviceId: 'DV0001', category: 'no_access', description: '', userName: 'Sam' },
      { target: { type: 'issue', kind: 'photo' }, files: [{ dataUrl: 'data:image/jpeg;base64,AAA', name: 'a.jpg' }] })
    expect(s.queue).toHaveLength(2)
    s.offline = false
    expect(await flush(deps)).toEqual({ sent: 2, stopped: false })
    expect(s.uploads).toEqual([['issue', 'RI0003', 'data:image/jpeg;base64,AAA']])
    expect(s.files.size).toBe(0)
    expect(s.sentIds[r.result.id]).toBe('RI0003')
  })

  it('uploads photos taken when finishing an online pickup against that pickup', async () => {
    const { s, deps } = setup(data({ pickups: [pickup({ status: 'ongoing', endAt: null })] }))
    await submit(deps, { ...finish('PK0001'), photos: 1 }, { target: { type: 'pickup', kind: 'after' }, files: [{ dataUrl: 'p', name: 'a.jpg' }] })
    await flush(deps)
    expect(s.uploads).toEqual([['pickup', 'PK0001', 'p']])
    expect(s.server.pickups[0]).toMatchObject({ status: 'done', photos: 1 })
  })

  it('puts photos of a pickup started and finished offline on its real id', async () => {
    const { s, deps } = setup(data({ seq: { PK: 41 } }))
    s.offline = true
    const p = (await submit<Pickup>(deps, start())).result
    await submit(deps, { ...finish(p.id), photos: 1 }, { target: { type: 'pickup', kind: 'after' }, files: [{ dataUrl: 'p', name: 'a.jpg' }] })
    expect(s.queue.map((i) => i.entityId || i.cmd?.kind)).toEqual(['startPickup', 'finishPickup', p.id])
    s.offline = false
    expect(await flush(deps)).toEqual({ sent: 3, stopped: false })
    expect(s.uploads).toEqual([['pickup', 'PK0042', 'p']])
  })

  it('queues photos of a record created online and uploads them on flush', async () => {
    const { s, deps } = setup()
    await submit(deps, { kind: 'reportIssue', at, deviceId: 'DV0001', category: 'no_access', description: '', userName: 'Sam' },
      { target: { type: 'issue', kind: 'photo' }, files: [{ dataUrl: 'x', name: 'a.jpg' }] })
    expect(s.queue).toEqual([expect.objectContaining({ entityId: 'RI0001' })])
    await flush(deps)
    expect(s.uploads).toEqual([['issue', 'RI0001', 'x']])
  })
})
