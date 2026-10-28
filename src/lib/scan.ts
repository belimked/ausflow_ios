import { codeOf, type Scanned } from './codes'

// Where the scanner was opened from decides which stickers it accepts.
// any: Today's scan button · vehicle: join a vehicle · facility: offload · transfer: pick the receiving vehicle.
export type ScanMode = 'any' | 'vehicle' | 'facility' | 'transfer'

export type ScanAction =
  | { go: 'device'; id: string }
  | { go: 'join'; vehicleId: string }
  // Old app: scanning another vehicle while carrying waste offers Change Vehicle or Transfer Waste.
  | { go: 'joinOrTransfer'; vehicleId: string }
  | { go: 'offload'; facilityId: string }
  | { go: 'transfer'; vehicleId: string }
  | { problem: string }

const WHAT: Record<ScanMode, string> = { any: 'device, vehicle or facility', vehicle: 'vehicle', facility: 'facility', transfer: 'vehicle' }

export function scanAction(hit: Scanned | null, raw: string, mode: ScanMode, ctx: { vehicleId?: string | null; onBoard: number }): ScanAction {
  if (!hit) return { problem: `No ${WHAT[mode]} found for “${codeOf(raw) || raw.trim()}”` }
  switch (mode) {
    case 'vehicle':
      return hit.kind === 'vehicle' ? { go: 'join', vehicleId: hit.item.id } : { problem: 'That is not a vehicle sticker.' }
    case 'facility':
      return hit.kind === 'facility' ? { go: 'offload', facilityId: hit.item.id } : { problem: 'That is not a facility plate.' }
    case 'transfer':
      if (hit.kind !== 'vehicle') return { problem: 'That is not a vehicle sticker.' }
      if (hit.item.id === ctx.vehicleId) return { problem: 'That is your own vehicle. Scan the vehicle receiving the waste.' }
      return { go: 'transfer', vehicleId: hit.item.id }
    case 'any':
      if (hit.kind === 'device') {
        return { go: 'device', id: hit.item.id }
      }
      if (hit.kind === 'facility') return { go: 'offload', facilityId: hit.item.id }
      if (ctx.onBoard > 0 && ctx.vehicleId && hit.item.id !== ctx.vehicleId) return { go: 'joinOrTransfer', vehicleId: hit.item.id }
      return { go: 'join', vehicleId: hit.item.id }
  }
}
