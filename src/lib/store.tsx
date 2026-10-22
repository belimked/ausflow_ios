import * as SecureStore from 'expo-secure-store'
import { useNetworkState } from 'expo-network'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import * as api from './api'
import { CommandError, type Command } from './commands'
import { vehicleLoads } from './load'
import { applyPayload, localView, type QueueItem, type SyncProblem } from './offline/queue'
import * as storage from './offline/storage'
import { PHOTO_TARGET } from './photos'
import { flush, submit as submitCommand, type NewPhoto, type OutboxDeps, type PhotoTarget } from './outbox'
import type { AppData, Coords, IssueCategory, Pickup, ReportedIssue, Transfer, Unload, User, WorkProfile } from './types'

export { findDeviceByCode } from './codes'

const SESSION_KEY = 'session'
const profileKey = (userId: string) => `profile_${userId}`

interface Session { token: string; user: User }

interface Store {
  ready: boolean
  session: Session | null
  // Server data plus everything still waiting to be sent.
  data: AppData | null
  loading: boolean
  error: string | null
  loadedAt: number | null
  profile: WorkProfile | null
  canWrite: boolean
  online: boolean
  pending: number
  syncing: boolean
  problems: SyncProblem[]
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  syncNow: () => Promise<void>
  retryProblem: (index: number) => void
  discardProblem: (index: number) => void
  // The real id of a record created offline, once it has been sent; the id itself otherwise.
  resolveId: (id: string) => string
  setProfile: (p: WorkProfile) => Promise<void>
  updateDetails: (input: { currentPassword: string; displayName?: string; email?: string | null; newPassword?: string }) => Promise<void>
  startJob: (deviceId: string, coords: Coords | null) => Promise<Pickup>
  finishJob: (pickupId: string, input: { volume: number; note: string; coords: Coords | null; waste?: string; plannedFacilityId?: string | null }, photos?: NewPhoto[]) => Promise<Pickup>
  cancelJob: (pickupId: string) => Promise<void>
  serviceOnly: (deviceId: string, input: { note: string; coords: Coords | null }) => Promise<Pickup>
  reportIssue: (deviceId: string, input: { category: IssueCategory; description: string }, photos: NewPhoto[]) => Promise<{ issue: ReportedIssue; queued: boolean }>
  unload: (input: { facilityId: string; volume: number; waste: string; coords: Coords | null }) => Promise<Unload>
  transfer: (toVehicleId: string, coords: Coords | null) => Promise<Transfer>
}

const Ctx = createContext<Store | null>(null)

const now = () => new Date().toISOString()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [serverData, setServerData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [profile, setProfileState] = useState<WorkProfile | null>(null)
  const [queue, setQueueState] = useState<QueueItem[]>([])
  const [problems, setProblemsState] = useState<SyncProblem[]>([])
  const [syncing, setSyncing] = useState(false)
  const [idMap, setIdMap] = useState<Record<string, string>>({})
  const network = useNetworkState()
  const online = network.isConnected !== false

  const sessionRef = useRef<Session | null>(null)
  const queueRef = useRef<QueueItem[]>([])
  const problemsRef = useRef<SyncProblem[]>([])
  const dataRef = useRef<AppData | null>(null)
  const flushing = useRef(false)
  useEffect(() => { sessionRef.current = session }, [session])

  const data = useMemo(() => (serverData ? localView(serverData, queue) : null), [serverData, queue])
  useEffect(() => { dataRef.current = data }, [data])

  // Queue and problems are kept per user on disk and survive sign-out, so offline work is never lost.
  const setQueue = useCallback((items: QueueItem[]) => {
    queueRef.current = items
    setQueueState(items)
    const s = sessionRef.current
    if (s) storage.saveQueue(s.user.id, items)
  }, [])

  const setProblems = useCallback((items: SyncProblem[]) => {
    problemsRef.current = items
    setProblemsState(items)
    const s = sessionRef.current
    if (s) storage.saveProblems(s.user.id, items)
  }, [])

  const clear = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY)
    sessionRef.current = null
    queueRef.current = []
    problemsRef.current = []
    setSession(null)
    setServerData(null)
    setProfileState(null)
    setLoadedAt(null)
    setQueueState([])
    setProblemsState([])
  }, [])

  // Throws the original error so callers can tell "offline" from other failures. `quiet` refreshes keep the
  // pull-to-refresh spinners still (background sync).
  const fetchState = useCallback(async (s: Session, quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const d = await api.fetchState(s.token)
      setServerData(d)
      const at = Date.now()
      setLoadedAt(at)
      setError(null)
      storage.saveSnapshot(s.user.id, d, at)
      return d
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 401) {
        await clear()
        setError('Your session has expired. Please sign in again. Work waiting to be sent is kept on this phone.')
      } else {
        setError((e as Error).message)
      }
      throw e
    } finally {
      if (!quiet) setLoading(false)
    }
  }, [clear])

  const load = useCallback(async (s: Session) => fetchState(s).catch(() => null), [fetchState])

  // Background sync: a quiet /state refresh, never more often than every 20 s.
  const lastRefresh = useRef(0)
  const refreshQuietly = useCallback(async (force = false) => {
    const s = sessionRef.current
    if (!s || (!force && Date.now() - lastRefresh.current < 20000)) return
    lastRefresh.current = Date.now()
    await fetchState(s, true).catch(() => {})
  }, [fetchState])

  const deps = useCallback((): OutboxDeps => ({
    fresh: async () => {
      const s = sessionRef.current
      if (!s) throw new api.ApiError('Not signed in', 401)
      return fetchState(s)
    },
    summary: async () => {
      const s = sessionRef.current
      if (!s) throw new api.ApiError('Not signed in', 401)
      return api.fetchSummary(s.token)
    },
    send: async (payload) => {
      const s = sessionRef.current
      if (!s) throw new api.ApiError('Not signed in', 401)
      return api.sync(s.token, payload)
    },
    reload: async () => { if (sessionRef.current) await fetchState(sessionRef.current) },
    apply: (payload) => setServerData((cur) => (cur ? applyPayload(cur, payload) : cur)),
    local: () => dataRef.current,
    getQueue: () => queueRef.current,
    setQueue,
    addProblems: (ps) => setProblems([...problemsRef.current, ...ps]),
    savePhoto: (p) => storage.savePhoto(p.dataUrl, p.name),
    uploadPhoto: async (target, id, photo) => {
      const s = sessionRef.current
      if (!s) throw new api.ApiError('Not signed in', 401)
      return api.uploadPhoto(s.token, { type: target.type, id, kind: target.kind, name: photo.name, dataUrl: await storage.readPhoto(photo) })
    },
    dropPhoto: storage.deletePhoto,
    now,
    onSent: (localId, realId) => setIdMap((m) => ({ ...m, [localId]: realId })),
  }), [fetchState, setQueue, setProblems])

  const syncNow = useCallback(async () => {
    if (flushing.current || !sessionRef.current || !queueRef.current.length) return
    flushing.current = true
    setSyncing(true)
    try {
      await flush(deps())
    } finally {
      flushing.current = false
      setSyncing(false)
    }
  }, [deps])

  // Restore everything this user had on the phone, then go online.
  const open = useCallback(async (s: Session) => {
    const [p, snap, q, pr] = await Promise.all([
      SecureStore.getItemAsync(profileKey(s.user.id)).catch(() => null),
      storage.loadSnapshot(s.user.id),
      storage.loadQueue(s.user.id),
      storage.loadProblems(s.user.id),
    ])
    setProfileState(p ? JSON.parse(p) : null)
    if (snap) {
      setServerData(snap.data)
      setLoadedAt(snap.loadedAt)
    }
    queueRef.current = q
    problemsRef.current = pr
    setQueueState(q)
    setProblemsState(pr)
    sessionRef.current = s
    setSession(s)
  }, [])

  useEffect(() => {
    ;(async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null)
      const s: Session | null = raw ? JSON.parse(raw) : null
      if (s) {
        await open(s)
        load(s).then(() => syncNow())
      }
      setReady(true)
    })()
  }, [open, load, syncNow])

  // Send the queue as soon as the phone is back online.
  useEffect(() => {
    if (online && session) syncNow()
  }, [online, session, syncNow])

  // Keep the phone's copy fresh in the background: when the app comes to the foreground and every 5 minutes.
  useEffect(() => {
    if (!session) return
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') refreshQuietly() })
    const timer = setInterval(() => { if (AppState.currentState === 'active') refreshQuietly() }, 5 * 60000)
    return () => { sub.remove(); clearInterval(timer) }
  }, [session, refreshQuietly])

  const signIn = useCallback(async (username: string, password: string) => {
    const s = await api.login(username.trim(), password)
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s))
    setError(null)
    await open(s)
    await load(s)
    syncNow()
  }, [open, load, syncNow])

  const refresh = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    await load(s)
    await syncNow()
  }, [load, syncNow])

  const setProfile = useCallback(async (p: WorkProfile) => {
    if (!sessionRef.current) return
    await SecureStore.setItemAsync(profileKey(sessionRef.current.user.id), JSON.stringify(p))
    setProfileState(p)
  }, [])

  // Old WasteID "My Details". The session keeps the new name; the token itself is unchanged.
  const updateDetails = useCallback(async (input: { currentPassword: string; displayName?: string; email?: string | null; newPassword?: string }) => {
    const s = sessionRef.current
    if (!s) throw new Error('Not signed in')
    const u = await api.updateMe(s.token, input)
    const next = { ...s, user: { ...s.user, displayName: u.displayName } }
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next))
    sessionRef.current = next
    setSession(next)
  }, [])

  const submit = useCallback(async <T,>(cmd: Command, photos?: { target: PhotoTarget; files: NewPhoto[] }) => {
    const r = await submitCommand<T>(deps(), cmd, photos)
    if (queueRef.current.length) syncNow()
    // Pick up other drivers' changes without making this write wait for a full download.
    else setTimeout(() => refreshQuietly(true), 1500)
    return r
  }, [deps, syncNow, refreshQuietly])

  const retryProblem = useCallback((index: number) => {
    const p = problemsRef.current[index]
    if (!p) return
    setProblems(problemsRef.current.filter((_, i) => i !== index))
    setQueue([...queueRef.current, p.item])
    syncNow()
  }, [setProblems, setQueue, syncNow])

  const discardProblem = useCallback((index: number) => {
    const p = problemsRef.current[index]
    if (!p) return
    for (const f of p.item.photos?.files || []) storage.deletePhoto(f)
    setProblems(problemsRef.current.filter((_, i) => i !== index))
  }, [setProblems])

  const resolveId = useCallback((id: string) => idMap[id] || id, [idMap])

  const userName = () => sessionRef.current?.user.displayName || ''
  const needProfile = (p: WorkProfile | null): WorkProfile => {
    if (!p) throw new CommandError('Choose your driver and vehicle first.')
    return p
  }

  const startJob = useCallback(async (deviceId: string, coords: Coords | null) =>
    (await submit<Pickup>({ kind: 'startPickup', at: now(), deviceId, profile: needProfile(profile), coords })).result, [profile, submit])

  const finishJob = useCallback(async (pickupId: string, input: { volume: number; note: string; coords: Coords | null; waste?: string; plannedFacilityId?: string | null }, photos: NewPhoto[] = []) =>
    (await submit<Pickup>({ kind: 'finishPickup', at: now(), pickupId, ...input, photos: photos.length, userName: userName() },
      photos.length ? { target: PHOTO_TARGET.pickupAfter, files: photos } : undefined)).result, [submit])

  const cancelJob = useCallback(async (pickupId: string) => {
    await submit<null>({ kind: 'cancelPickup', at: now(), pickupId })
  }, [submit])

  const serviceOnly = useCallback(async (deviceId: string, input: { note: string; coords: Coords | null }) =>
    (await submit<Pickup>({ kind: 'serviceOnly', at: now(), deviceId, profile: needProfile(profile), ...input, userName: userName() })).result, [profile, submit])

  const reportIssue = useCallback(async (deviceId: string, input: { category: IssueCategory; description: string }, photos: NewPhoto[]) => {
    const r = await submit<ReportedIssue>({ kind: 'reportIssue', at: now(), deviceId, ...input, userName: userName() },
      photos.length ? { target: PHOTO_TARGET.issue, files: photos } : undefined)
    return { issue: r.result, queued: r.queued }
  }, [submit])

  const unload = useCallback(async (input: { facilityId: string; volume: number; waste: string; coords: Coords | null }) =>
    (await submit<Unload>({ kind: 'unload', at: now(), profile: needProfile(profile), ...input })).result, [profile, submit])

  const transfer = useCallback(async (toVehicleId: string, coords: Coords | null) =>
    (await submit<Transfer>({ kind: 'transfer', at: now(), profile: needProfile(profile), toVehicleId, coords })).result, [profile, submit])

  const canWrite = !!session && ['admin', 'ops', 'authority'].includes(session.user.role)

  const value = useMemo<Store>(() => ({
    ready, session, data, loading, error, loadedAt, profile, canWrite, online, pending: queue.length, syncing, problems,
    signIn, signOut: clear, refresh, syncNow, retryProblem, discardProblem, resolveId, setProfile, updateDetails,
    startJob, finishJob, cancelJob, serviceOnly, reportIssue, unload, transfer,
  }), [ready, session, data, loading, error, loadedAt, profile, canWrite, online, queue, syncing, problems,
    signIn, clear, refresh, syncNow, retryProblem, discardProblem, resolveId, setProfile, updateDetails,
    startJob, finishJob, cancelJob, serviceOnly, reportIssue, unload, transfer])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

export function useIndex() {
  const { data } = useStore()
  return useMemo(() => {
    const by = <T extends { id: string }>(rows: T[] = []) => new Map(rows.map((r) => [r.id, r]))
    const ongoingByDevice = new Map<string, Pickup>()
    for (const p of data?.pickups || []) if (p.status === 'ongoing' && p.deviceId) ongoingByDevice.set(p.deviceId, p)
    return {
      devices: by(data?.devices), locations: by(data?.locations), drivers: by(data?.drivers),
      vehicles: by(data?.vehicles), companies: by(data?.companies), facilities: by(data?.facilities),
      pickups: by(data?.pickups), ongoingByDevice,
      // Litres currently on board per vehicle id, derived the same way as the web console.
      loads: data ? vehicleLoads(data) : new Map<string, number>(),
    }
  }, [data])
}
