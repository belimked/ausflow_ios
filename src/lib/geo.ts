import * as Location from 'expo-location'
import type { Coords } from './types'

export function distanceM(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null) {
  if (lat1 == null || lng1 == null || lat2 == null || lng2 == null) return null
  const R = 6371e3, rad = Math.PI / 180
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lng2 - lng1) * rad) / 2) ** 2
  return Math.round(2 * R * Math.asin(Math.sqrt(a)))
}

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
