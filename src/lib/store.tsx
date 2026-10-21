import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { CommandError, type Command } from './commands'
import { vehicleLoads } from './load'
import { createOutbox } from './outbox'
import type { AppData, Coords, IssueCategory, Pickup, ReportedIssue, Transfer, Unload, User, WorkProfile } from './types'

export { findDeviceByCode } from './codes'

const SESSION_KEY = 'session'
const profileKey = (userId: string) => `profile_${userId}`

interface Session { token: string; user: User }

interface Store {
  ready: boolean
  session: Session | null
  data: AppData | null
  loading: boolean
  error: string | null
  loadedAt: number | null
  profile: WorkProfile | null
  canWrite: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  setProfile: (p: WorkProfile) => Promise<void>
  startJob: (deviceId: string, coords: Coords | null) => Promise<Pickup>
  finishJob: (pickupId: string, input: { volume: number; note: string; coords: Coords | null; waste?: string }) => Promise<Pickup>
  cancelJob: (pickupId: string) => Promise<void>
  serviceOnly: (deviceId: string, input: { note: string; coords: Coords | null }) => Promise<Pickup>
  reportIssue: (deviceId: string, input: { category: IssueCategory; description: string }) => Promise<ReportedIssue>
  uploadPhotos: (target: { type: string; kind: string }, id: string, photos: { dataUrl: string; name: string }[]) => Promise<{ uploaded: number; failed: number }>
  unload: (input: { facilityId: string; volume: number; waste: string; coords: Coords | null }) => Promise<Unload>
  transfer: (toVehicleId: string, coords: Coords | null) => Promise<Transfer>
}

const Ctx = createContext<Store | null>(null)

const now = () => new Date().toISOString()

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [profile, setProfileState] = useState<WorkProfile | null>(null)
  const sessionRef = useRef<Session | null>(null)
  useEffect(() => { sessionRef.current = session }, [session])

  const clear = useCallback(async () => {
    await SecureStore.deleteItemAsync(SESSION_KEY)
    setSession(null)
    setData(null)
    setProfileState(null)
    setLoadedAt(null)
  }, [])

  const load = useCallback(async (s: Session) => {
    setLoading(true)
    try {
      const d = await api.fetchState(s.token)
      setData(d)
      setLoadedAt(Date.now())
      setError(null)
      return d
    } catch (e) {
      if (e instanceof api.ApiError && e.status === 401) {
        await clear()
        setError('Your session has expired. Please sign in again.')
      } else {
        setError((e as Error).message)
      }
      return null
    } finally {
      setLoading(false)
    }
  }, [clear])

  useEffect(() => {
    ;(async () => {
      const raw = await SecureStore.getItemAsync(SESSION_KEY).catch(() => null)
      const s: Session | null = raw ? JSON.parse(raw) : null
      if (s) {
        const p = await SecureStore.getItemAsync(profileKey(s.user.id)).catch(() => null)
        setProfileState(p ? JSON.parse(p) : null)
        setSession(s)
        load(s)
      }
      setReady(true)
    })()
  }, [load])

  const signIn = useCallback(async (username: string, password: string) => {
    const s = await api.login(username.trim(), password)
    await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(s))
    const p = await SecureStore.getItemAsync(profileKey(s.user.id)).catch(() => null)
    setProfileState(p ? JSON.parse(p) : null)
    setError(null)
    setSession(s)
    await load(s)
  }, [load])

  const refresh = useCallback(async () => { if (sessionRef.current) await load(sessionRef.current) }, [load])

  const setProfile = useCallback(async (p: WorkProfile) => {
    if (!sessionRef.current) return
    await SecureStore.setItemAsync(profileKey(sessionRef.current.user.id), JSON.stringify(p))
    setProfileState(p)
  }, [])

  const fresh = useCallback(async () => {
    const s = sessionRef.current
    if (!s) throw new Error('Not signed in')
    const d = await load(s)
    if (!d) throw new Error('Could not load the latest data. Please try again.')
    return d
  }, [load])

  const send = useCallback(async (payload: api.SyncPayload) => {
    const s = sessionRef.current
    if (!s) throw new Error('Not signed in')
    return api.sync(s.token, payload)
  }, [])

  // Built per call (not during render) so the outbox only reads the session ref while a write is running.
  const submit = useCallback(<T,>(cmd: Command) => createOutbox({ fresh, send, reload: refresh }).submit<T>(cmd), [fresh, send, refresh])

  const startJob = useCallback(async (deviceId: string, coords: Coords | null) => {
    if (!profile) throw new CommandError('Choose your driver and vehicle first.')
    return submit<Pickup>({ kind: 'startPickup', at: now(), deviceId, profile, coords })
  }, [profile, submit])

  const finishJob = useCallback(async (pickupId: string, input: { volume: number; note: string; coords: Coords | null; waste?: string }) => {
    const userName = sessionRef.current?.user.displayName || ''
    return submit<Pickup>({ kind: 'finishPickup', at: now(), pickupId, ...input, userName })
  }, [submit])

  const cancelJob = useCallback(async (pickupId: string) => {
    await submit<null>({ kind: 'cancelPickup', at: now(), pickupId })
  }, [submit])

  const serviceOnly = useCallback(async (deviceId: string, input: { note: string; coords: Coords | null }) => {
    if (!profile) throw new CommandError('Choose your driver and vehicle first.')
    const userName = sessionRef.current?.user.displayName || ''
    return submit<Pickup>({ kind: 'serviceOnly', at: now(), deviceId, profile, ...input, userName })
  }, [profile, submit])

  const reportIssue = useCallback(async (deviceId: string, input: { category: IssueCategory; description: string }) => {
    const userName = sessionRef.current?.user.displayName || ''
    return submit<ReportedIssue>({ kind: 'reportIssue', at: now(), deviceId, ...input, userName })
  }, [submit])

  // Photos go to /photos, not /sync. One failed photo does not stop the others; the caller reports what failed.
  const uploadPhotos = useCallback(async (target: { type: string; kind: string }, id: string, photos: { dataUrl: string; name: string }[]) => {
    const s = sessionRef.current
    if (!s) throw new Error('Not signed in')
    let uploaded = 0
    for (const p of photos) {
      try {
        await api.uploadPhoto(s.token, { type: target.type, id, kind: target.kind, name: p.name, dataUrl: p.dataUrl })
        uploaded++
      } catch {
        // counted below
      }
    }
    return { uploaded, failed: photos.length - uploaded }
  }, [])

  const unload = useCallback(async (input: { facilityId: string; volume: number; waste: string; coords: Coords | null }) => {
    if (!profile) throw new CommandError('Choose your driver and vehicle first.')
    return submit<Unload>({ kind: 'unload', at: now(), profile, ...input })
  }, [profile, submit])

  const transfer = useCallback(async (toVehicleId: string, coords: Coords | null) => {
    if (!profile) throw new CommandError('Choose your driver and vehicle first.')
    return submit<Transfer>({ kind: 'transfer', at: now(), profile, toVehicleId, coords })
  }, [profile, submit])

  const canWrite = !!session && ['admin', 'ops', 'authority'].includes(session.user.role)

  const value = useMemo<Store>(() => ({
    ready, session, data, loading, error, loadedAt, profile, canWrite,
    signIn, signOut: clear, refresh, setProfile, startJob, finishJob, cancelJob, serviceOnly, reportIssue, uploadPhotos, unload, transfer,
  }), [ready, session, data, loading, error, loadedAt, profile, canWrite, signIn, clear, refresh, setProfile, startJob, finishJob, cancelJob, serviceOnly, reportIssue, uploadPhotos, unload, transfer])

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
