import * as Location from 'expo-location'
import { useEffect, useState } from 'react'
import type { Coords } from './types'

export { distanceM } from './geo-math'

// Job coordinates only decide whether the driver was near the device or facility (LOCATION_FLAG_METRES = 200),
// so a sample this good ends the wait. iOS gives ~65 m from Wi-Fi alone, which is enough and often all a truck
// cab ever gets.
export const GOOD_ACCURACY_M = 100
// A good fix is reused for this long: a driver scans, reads the page and taps within it.
export const REUSE_MS = 60000
// How long the GPS is watched for a good sample before the best one seen is kept.
export const FIX_TIMEOUT_MS = 4000
// How long a tap waits for a fix in progress; after that the best sample so far (or the last known
// position) is used and the watch carries on for the next screen.
export const TAP_WAIT_MS = 2000

const toCoords = (pos: Location.LocationObject): Coords =>
  ({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy })

const better = (a: Coords | null, b: Coords) => !a || (b.accuracy ?? Infinity) < (a.accuracy ?? Infinity)

// Best sample of the watch in progress, for a tap that will not wait for it to finish.
let partial: Coords | null = null

// Watches the GPS until a sample is good enough or the timeout passes, then returns the best sample seen.
async function watchFix(): Promise<Coords | null> {
  return new Promise((resolve) => {
    let best: Coords | null = null
    partial = null
    let done = false
    let sub: Location.LocationSubscription | null = null
    const finish = () => {
      if (done) return
      done = true
      clearTimeout(timer)
      sub?.remove()
      resolve(best)
    }
    const timer = setTimeout(finish, FIX_TIMEOUT_MS)
    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 500, distanceInterval: 0 }, (pos) => {
      const c = toCoords(pos)
      if (better(best, c)) best = partial = c
      if ((c.accuracy ?? Infinity) <= GOOD_ACCURACY_M) finish()
    }).then((s) => {
      sub = s
      if (done) s.remove()
    }, finish)
  })
}

let last: { coords: Coords; at: number } | null = null
let pending: Promise<Coords | null> | null = null

const recentGoodFix = () =>
  last && Date.now() - last.at < REUSE_MS && (last.coords.accuracy ?? Infinity) <= GOOD_ACCURACY_M ? last.coords : null

// One GPS request shared by everyone waiting for it.
function fetchFix(): Promise<Coords | null> {
  if (pending) return pending
  pending = (async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync()
      if (perm.status !== 'granted') return null
      const fix = await watchFix()
      const c = fix || (await lastKnown())
      if (c) last = { coords: c, at: Date.now() }
      return c
    } finally {
      pending = null
    }
  })()
  return pending
}

const lastKnown = () =>
  Location.getLastKnownPositionAsync({ maxAge: 5 * 60000 }).then((p) => (p ? toCoords(p) : null)).catch(() => null)

// Where the driver is, for recording a job: a recent good fix, else the fix in progress (started when the
// screen opened) if it finishes within TAP_WAIT_MS, else the best sample seen so far, else the last known
// position. Null when permission is denied or nothing is known; the job is then flagged "no location".
// Asks for permission on first use.
export async function currentCoords(): Promise<Coords | null> {
  const recent = recentGoodFix()
  if (recent) return recent
  const fix = fetchFix()
  const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TAP_WAIT_MS))
  const r = await Promise.race([fix, timeout])
  if (r !== 'timeout') return r
  return partial || last?.coords || lastKnown()
}

// Start locating now so a later currentCoords() does not wait for the GPS. Call it when a screen with a
// location-stamped action opens.
export function prefetchCoords(): Promise<Coords | null> {
  const recent = recentGoodFix()
  return recent ? Promise.resolve(recent) : fetchFix()
}

// Last known position without prompting for permission; for distances shown on screen, so any recent fix will do.
export async function quietCoords(): Promise<Coords | null> {
  if (last && Date.now() - last.at < REUSE_MS) return last.coords
  const perm = await Location.getForegroundPermissionsAsync()
  if (perm.status !== 'granted') return null
  const pos = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60000 }).catch(() => null)
  return pos ? toCoords(pos) : null
}

// For screens with a location-stamped action: locating starts when the screen opens, and `here` is the best
// position so far (the last known one first, then the fix), for distances shown before the driver taps.
export function useLocationFix(): Coords | null {
  const [here, setHere] = useState<Coords | null>(null)
  useEffect(() => {
    let live = true
    quietCoords().then((c) => { if (live && c) setHere((h) => h || c) })
    prefetchCoords().then((c) => { if (live && c) setHere(c) })
    return () => { live = false }
  }, [])
  return here
}

// Test hook: forget the cached fix.
export function resetGeoCache() {
  last = null
  pending = null
  partial = null
}
