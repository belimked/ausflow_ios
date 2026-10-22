import type { AppData, Company, Vehicle, WorkProfile } from './types'

export const isTransport = (c: Pick<Company, 'types'>) => {
  try { return JSON.parse(c.types || '["transport"]').includes('transport') } catch { return true }
}

const activeDrivers = (d: Pick<AppData, 'drivers'>, companyId: string) => d.drivers.filter((x) => x.companyId === companyId && x.status === 'active')

// Old WasteID "Join Vehicle": the vehicle decides the company; keep the current driver when they belong to it,
// otherwise pick the only active driver, or leave it for the driver to choose.
export function joinVehicle(d: Pick<AppData, 'drivers'>, current: WorkProfile | null, vehicle: Vehicle): WorkProfile {
  const companyId = vehicle.companyId || ''
  const drivers = activeDrivers(d, companyId)
  const keep = current && drivers.some((x) => x.id === current.driverId) ? current.driverId : ''
  return { companyId, vehicleId: vehicle.id, driverId: keep || (drivers.length === 1 ? drivers[0].id : '') }
}

const plateKey = (s: string) => s.replace(/\s+/g, '').toUpperCase()

// Active vehicles of active transport companies whose plate contains the query, ignoring spaces and case.
export function findVehiclesByPlate(d: Pick<AppData, 'vehicles' | 'companies'>, query: string) {
  const q = plateKey(query)
  if (!q) return []
  const ok = new Set(d.companies.filter((c) => c.status === 'active' && isTransport(c)).map((c) => c.id))
  return d.vehicles.filter((v) => v.status === 'active' && ok.has(v.companyId || '') && plateKey(v.plate).includes(q))
}
