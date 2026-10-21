import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { FEATURES } from './config'
import { currentCycle } from './load'
import { mockTrailers, pruneAssignments, trailerLoads, type MockTrailer } from './mock/trailers'
import { useStore } from './store'

// DEMO ONLY (FEATURES.trailers === 'mock'): attached trailers and pickup → trailer assignments live on the phone.

interface Saved { attached: string[]; assigned: Record<string, string> }
const EMPTY: Saved = { attached: [], assigned: {} }

interface Trailers {
  enabled: boolean
  available: MockTrailer[]
  attached: MockTrailer[]
  loads: Map<string, number>
  attach: (id: string) => void
  detach: (id: string) => void
  assign: (pickupId: string, trailerId: string) => void
}

const Ctx = createContext<Trailers | null>(null)
const keyOf = (userId: string) => `trailers_${userId}`

export function TrailerProvider({ children }: { children: ReactNode }) {
  const { session, profile, data } = useStore()
  const enabled = FEATURES.trailers === 'mock'
  const userId = session?.user.id
  // dirty: changed on this phone since it was loaded, so it needs saving.
  const [saved, setSaved] = useState<{ userId?: string; value: Saved; dirty: boolean }>({ value: EMPTY, dirty: false })

  useEffect(() => {
    if (!enabled || !userId) return
    SecureStore.getItemAsync(keyOf(userId)).catch(() => null).then((raw) => {
      setSaved({ userId, value: raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY, dirty: false })
    })
  }, [enabled, userId])

  useEffect(() => {
    if (saved.dirty && saved.userId) SecureStore.setItemAsync(keyOf(saved.userId), JSON.stringify(saved.value)).catch(() => {})
  }, [saved])

  const value = saved.userId === userId ? saved.value : EMPTY
  const update = useCallback((next: (v: Saved) => Saved) => {
    if (!userId) return
    setSaved((cur) => ({ userId, value: next(cur.userId === userId ? cur.value : EMPTY), dirty: true }))
  }, [userId])

  const cycle = useMemo(() => (data && profile ? currentCycle(data, profile.vehicleId) : null), [data, profile])

  const ctx = useMemo<Trailers>(() => {
    const available = enabled && profile ? mockTrailers(profile.companyId) : []
    return {
      enabled,
      available,
      attached: available.filter((t) => value.attached.includes(t.id)),
      loads: trailerLoads(value.assigned, cycle),
      attach: (id) => update((v) => (v.attached.includes(id) ? v : { ...v, attached: [...v.attached, id] })),
      detach: (id) => update((v) => ({ ...v, attached: v.attached.filter((x) => x !== id) })),
      assign: (pickupId, trailerId) => update((v) => {
        const onBoard = new Set([...(cycle?.pickups || []).map((p) => p.id), pickupId])
        return { ...v, assigned: { ...pruneAssignments(v.assigned, onBoard), [pickupId]: trailerId } }
      }),
    }
  }, [enabled, profile, value, cycle, update])

  return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
}

export function useTrailers() {
  const t = useContext(Ctx)
  if (!t) throw new Error('useTrailers must be used inside TrailerProvider')
  return t
}
