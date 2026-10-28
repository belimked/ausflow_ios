import type { Pickup } from './types'

// A device's company is the company on its most recently completed pickup, never its stored assignment.
export function lastServiceCompanies(pickups: Pickup[]): Map<string, string> {
  const latest = new Map<string, Pickup>()
  for (const p of pickups) {
    if (p.status !== 'done' || !p.deviceId || !p.endAt) continue
    const prev = latest.get(p.deviceId)
    if (!prev || p.endAt > (prev.endAt || '') || (p.endAt === prev.endAt && (p.startAt || '') > (prev.startAt || ''))) latest.set(p.deviceId, p)
  }
  const result = new Map<string, string>()
  for (const [id, p] of latest) if (p.companyId) result.set(id, p.companyId)
  return result
}

export const servicedBy = (companies: Map<string, string>, deviceId: string) => companies.get(deviceId) || null
