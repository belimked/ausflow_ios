import { distanceM } from './geo-math'
import type { LoadCycle } from './load'
import type { Coords, Facility } from './types'

// Warn (never block) when the delivered volume differs from what is on board by more than this share.
// The threshold is one of the open questions for the client.
export const UNLOAD_DIFF_WARN = 0.1

// Active facilities, nearest first; facilities without coordinates go last, by name.
export function nearbyFacilities(facilities: Facility[], here: Coords | null) {
  return facilities.filter((f) => f.status === 'active')
    .map((f) => ({ facility: f, distance: distanceM(here?.lat, here?.lng, f.lat, f.lng) }))
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity) || a.facility.name.localeCompare(b.facility.name))
}

// Share by which the delivered volume differs from the load on board; null when nothing is recorded on board.
export function volumeGap(onBoard: number, delivered: number) {
  if (!(onBoard > 0)) return null
  return Math.abs(delivered - onBoard) / onBoard
}

// The waste type that makes up most of the load, to prefill the delivery.
export function cycleWaste(cycle: LoadCycle | null) {
  const litres = new Map<string, number>()
  for (const p of cycle?.pickups || []) {
    const w = (p.waste || '').trim()
    if (w && (p.volume || 0) > 0) litres.set(w, (litres.get(w) || 0) + (p.volume || 0))
  }
  let best = ''
  for (const [w, l] of litres) if (!best || l > (litres.get(best) || 0)) best = w
  return best
}

// The receiving vehicle would hold more than its tank after the transfer.
export const overCapacity = (toLoad: number, volume: number, tank?: number | null) => !!tank && toLoad + volume > tank
