export type Role = 'admin' | 'ops' | 'user' | 'authority'

export interface User {
  id: string
  username: string
  displayName: string
  role: Role
}

export interface Company { id: string; name: string; phone?: string | null; status: string; types: string }

export interface Location {
  id: string; name: string; agreementNo?: string | null
  address1?: string | null; address2?: string | null; suburb?: string | null; state?: string | null; postcode?: string | null
  lat?: number | null; lng?: number | null; status: string
}

export interface Device {
  id: string; ref: string; number?: string | null; aka?: string | null; status: string
  type?: string | null; waste?: string | null; qr?: string | null; tags?: string | null
  capacity?: number | null; lat?: number | null; lng?: number | null
  freqWeeks?: number | null; lastService?: string | null
  approvalCategory?: string | null; risk?: string | null
  locationDesc?: string | null; comments?: string | null
  locationId?: string | null; companyId?: string | null; ownerId?: string | null
}

export interface Driver { id: string; companyId?: string | null; name: string; account?: string | null; phone?: string | null; status: string }

export interface Vehicle { id: string; companyId?: string | null; plate: string; type?: string | null; tank?: number | null; qr?: string | null; status: string }

export type PickupFlag = 'location' | 'nolocation' | 'capacity'

export interface Pickup {
  id: string; deviceId?: string | null; locationId?: string | null; companyId?: string | null
  driverId?: string | null; vehicleId?: string | null
  volume?: number | null; waste?: string | null
  startAt?: string | null; endAt?: string | null
  startLat?: number | null; startLng?: number | null; endLat?: number | null; endLng?: number | null
  distance?: number | null; photos?: number | null; flags?: PickupFlag[] | null; note?: string | null
  status: 'ongoing' | 'done'
}

export interface Facility { id: string; name: string; address?: string | null; lat?: number | null; lng?: number | null; qr?: string | null; status: string }

// Waste moved from one vehicle to another (old WasteID "Transfer Waste").
export interface Transfer {
  id: string; companyId?: string | null; driverId?: string | null
  fromVehicleId: string; toVehicleId: string; volume: number
  at: string; lat?: number | null; lng?: number | null
}

// Waste discharged at a treatment facility (old WasteID "Offload / Deliver Waste").
export interface Unload {
  id: string; companyId?: string | null; driverId?: string | null
  vehicleId: string; facilityId?: string | null; waste?: string | null; volume: number
  at: string; lat?: number | null; lng?: number | null
}

export type IssueCategory = 'baffle_damaged' | 'no_washdown_tap' | 'premises_closed' | 'no_access' | 'qr_missing' | 'other'

export interface ReportedIssue {
  id: string; deviceId: string; category: IssueCategory; description?: string | null
  reportedBy?: string | null; at: string; status: 'open' | 'resolved' | string; source: string
}

export interface Photo { id: string; entityType: string; entityId: string; kind: string; name?: string | null; dataUrl: string; user?: string | null; at?: string | null }

export interface ChangeLog {
  id: string; deviceId: string | null; entityType: string; entityId: string | null
  field: string; oldValue: string; newValue: string; user: string; source: string; at: string
}

export interface AppData {
  seq: Record<string, number>
  companies: Company[]
  locations: Location[]
  devices: Device[]
  drivers: Driver[]
  vehicles: Vehicle[]
  facilities: Facility[]
  pickups: Pickup[]
  transfers: Transfer[]
  unloads: Unload[]
  reportedIssues: ReportedIssue[]
}

export interface WorkProfile { companyId: string; driverId: string; vehicleId: string }

export interface Coords { lat: number; lng: number; accuracy?: number | null }
