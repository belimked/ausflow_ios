import type { Role } from './types'

// Which tab group a person lands in. Drivers (`ops`) work in the Today / History / Devices / Me app; every other
// role gets the console (Dashboard / Devices / Records / Me). It is a per-user preference on the phone, so an
// admin can drop into the driver view to record a pickup or demo the app.
export type ViewMode = 'admin' | 'driver'

export const defaultViewMode = (role: Role | string | undefined): ViewMode => (role === 'ops' ? 'driver' : 'admin')

// Only console roles see the "switch view" entries; drivers have no console entry.
export const canUseConsole = (role: Role | string | undefined) => role !== 'ops'

export const ROLE_LABEL: Record<string, string> = { admin: 'Admin', authority: 'Admin', ops: 'Operations', user: 'View only' }
