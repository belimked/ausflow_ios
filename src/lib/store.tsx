import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as api from './api'
import { LOCATION_FLAG_METRES } from './config'
import { normName } from './format'
import { distanceM } from './geo'
import type { AppData, ChangeLog, Coords, Device, Pickup, PickupFlag, User, WorkProfile } from './types'

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
  finishJob: (pickupId: string, input: { volume: number; note: string; coords: Coords | null }) => Promise<Pickup>
  cancelJob: (pickupId: string) => Promise<void>
}

const Ctx = createContext<Store | null>(null)

function nextId(data: AppData, prefix: string, rows: { id: string }[]) {
  // The server only keeps the highest seq it has seen, so also check existing ids in case another client lagged.
  const re = new RegExp(`^${prefix}(\\d+)$`)
  let n = data.seq[prefix] || 0
  for (const r of rows) {
    const m = re.exec(r.id)
    if (m) n = Math.max(n, Number(m[1]))
  }
  n += 1
  return { id: prefix + String(n).padStart(4, '0'), seq: { ...data.seq, [prefix]: n } }
}

const isoDate = (s?: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '')

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

  // Writes always start from a fresh copy of the server state so ids and "already in progress" checks are current.
  const fresh = useCallback(async () => {
    const s = sessionRef.current
    if (!s) throw new Error('Not signed in')
    const d = await load(s)
    if (!d) throw new Error('Could not load the latest data. Please try again.')
    return { s, d }
  }, [load])

  const commit = useCallback(async (s: Session, d: AppData, upserts: Record<string, unknown[]>, seq: Record<string, number>, deletes?: Record<string, string[]>) => {
    await api.sync(s.token, { upserts, seq, ...(deletes ? { deletes } : {}) })
    await load(s)
  }, [load])

  const startJob = useCallback(async (deviceId: string, coords: Coords | null) => {
    if (!profile) throw new Error('Choose your driver and vehicle first.')
    const { s, d } = await fresh()
    const dev = d.devices.find((x) => x.id === deviceId)
    if (!dev) throw new Error('This device no longer exists.')
    const busy = d.pickups.find((p) => p.status === 'ongoing' && p.deviceId === deviceId)
    if (busy) throw new Error('A pickup is already in progress at this device.')
    const mine = d.pickups.find((p) => p.status === 'ongoing' && p.driverId === profile.driverId)
    if (mine) throw new Error('You already have a pickup in progress. Finish it before starting another.')
    const { id, seq } = nextId(d, 'PK', d.pickups)
    const pickup: Pickup = {
      id, deviceId, locationId: dev.locationId ?? null, companyId: profile.companyId, driverId: profile.driverId, vehicleId: profile.vehicleId,
      volume: null, waste: normName(dev.waste) || 'Grease Trap Waste', startAt: new Date().toISOString(), endAt: null,
      startLat: coords?.lat ?? null, startLng: coords?.lng ?? null, endLat: null, endLng: null,
      distance: distanceM(dev.lat, dev.lng, coords?.lat, coords?.lng), photos: 0, flags: [], note: '', status: 'ongoing',
    }
    await commit(s, d, { pickups: [pickup] }, seq)
    return pickup
  }, [profile, fresh, commit])

  const finishJob = useCallback(async (pickupId: string, input: { volume: number; note: string; coords: Coords | null }) => {
    const { s, d } = await fresh()
    const p = d.pickups.find((x) => x.id === pickupId)
    if (!p) throw new Error('This pickup was removed by someone else.')
    if (p.status !== 'ongoing') throw new Error('This pickup has already been completed.')
    const dev = d.devices.find((x) => x.id === p.deviceId) as Device | undefined
    const endAt = new Date().toISOString()
    const distance = distanceM(dev?.lat, dev?.lng, input.coords?.lat, input.coords?.lng)
    const flags: PickupFlag[] = []
    if (distance != null && distance > LOCATION_FLAG_METRES) flags.push('location')
    if (!input.coords) flags.push('nolocation')
    if (dev?.capacity && input.volume > dev.capacity) flags.push('capacity')
    const done: Pickup = {
      ...p, volume: input.volume, note: input.note.trim(), endAt,
      endLat: input.coords?.lat ?? null, endLng: input.coords?.lng ?? null, distance: distance ?? p.distance ?? null, flags, status: 'done',
    }
    const upserts: Record<string, unknown[]> = { pickups: [done] }
    let seq = d.seq
    if (dev) {
      const cl = nextId(d, 'CL', [])
      seq = cl.seq
      const log: ChangeLog = {
        id: cl.id, deviceId: dev.id, entityType: 'device', entityId: dev.id, field: 'Last service',
        oldValue: isoDate(dev.lastService), newValue: isoDate(endAt), user: s.user.displayName, source: 'App', at: endAt,
      }
      upserts.devices = [{ ...dev, lastService: endAt }]
      upserts.changeLogs = [log]
    }
    await commit(s, d, upserts, seq)
    return done
  }, [fresh, commit])

  const cancelJob = useCallback(async (pickupId: string) => {
    const { s, d } = await fresh()
    const p = d.pickups.find((x) => x.id === pickupId)
    if (!p || p.status !== 'ongoing') return
    await commit(s, d, {}, d.seq, { pickups: [pickupId] })
  }, [fresh, commit])

  const canWrite = !!session && ['admin', 'ops', 'authority'].includes(session.user.role)

  const value = useMemo<Store>(() => ({
    ready, session, data, loading, error, loadedAt, profile, canWrite,
    signIn, signOut: clear, refresh, setProfile, startJob, finishJob, cancelJob,
  }), [ready, session, data, loading, error, loadedAt, profile, canWrite, signIn, clear, refresh, setProfile, startJob, finishJob, cancelJob])

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
      vehicles: by(data?.vehicles), companies: by(data?.companies), pickups: by(data?.pickups), ongoingByDevice,
    }
  }, [data])
}

// QR labels encode "http://QR2id.net/?X@<code>"; some devices carry several tag codes.
export function findDeviceByCode(devices: Device[], raw: string) {
  const text = raw.trim()
  const code = (text.includes('@') ? text.slice(text.lastIndexOf('@') + 1) : text).trim().toUpperCase()
  if (!code) return null
  return devices.find((d) =>
    d.ref.toUpperCase() === code || (d.qr || '').toUpperCase() === code ||
    (d.tags || '').toUpperCase().split(/\s+/).includes(code)) || null
}
