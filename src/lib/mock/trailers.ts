import type { LoadCycle } from '../load'

// DEMO ONLY. Trailers/dogs (old WasteID "Attach Trailer") are not modelled on the backend. These trailers are
// generated on the phone, and which pickup went into which trailer is kept on the phone too; on the server every
// pickup stays on the towing vehicle.

export interface MockTrailer { id: string; companyId: string; plate: string; tank: number }

// Stable per company, so a demo looks the same every time.
export function mockTrailers(companyId: string): MockTrailer[] {
  let h = 0
  for (const ch of companyId) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const count = 2 + (h % 2)
  return Array.from({ length: count }, (_, i) => ({
    id: `MOCK-TRAILER-${companyId}-${i + 1}`,
    companyId,
    plate: `TL ${String(100 + ((h + i * 37) % 900)).padStart(3, '0')}`,
    tank: i === 0 ? 10000 : 8000,
  }))
}

// Litres in each trailer: pickups assigned to it that are still part of the towing vehicle's current load.
// When the vehicle is offloaded or transferred, its cycle ends and the trailers empty with it.
export function trailerLoads(assigned: Record<string, string>, cycle: LoadCycle | null) {
  const m = new Map<string, number>()
  for (const p of cycle?.pickups || []) {
    const t = assigned[p.id]
    if (t) m.set(t, (m.get(t) || 0) + (p.volume || 0))
  }
  return m
}

// Keep the stored assignments small: only pickups still on board matter.
export function pruneAssignments(assigned: Record<string, string>, onBoardIds: Set<string>) {
  return Object.fromEntries(Object.entries(assigned).filter(([pid]) => onBoardIds.has(pid)))
}
