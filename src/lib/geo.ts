import * as Location from 'expo-location'
import type { Coords } from './types'

export { distanceM } from './geo-math'

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))])

// Returns null when permission is denied or no fix arrives in time; the job is then flagged "no location".
export async function currentCoords(): Promise<Coords | null> {
  const perm = await Location.requestForegroundPermissionsAsync()
  if (perm.status !== 'granted') return null
  const fix = await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 12000).catch(() => null)
  const pos = fix || (await Location.getLastKnownPositionAsync({ maxAge: 5 * 60000 }).catch(() => null))
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy } : null
}

export async function quietCoords(): Promise<Coords | null> {
  const perm = await Location.getForegroundPermissionsAsync()
  if (perm.status !== 'granted') return null
  const pos = await Location.getLastKnownPositionAsync({ maxAge: 10 * 60000 }).catch(() => null)
  return pos ? { lat: pos.coords.latitude, lng: pos.coords.longitude } : null
}
