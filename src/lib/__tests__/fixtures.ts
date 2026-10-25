import type { AppData, Device, Pickup, Transfer, Unload, WorkProfile } from '../types'

export const profile: WorkProfile = { companyId: 'CO0001', driverId: 'DR0001', vehicleId: 'VE0001' }

export const device = (over: Partial<Device> = {}): Device => ({
  id: 'DV0001', ref: 'DV539135', status: 'Active', waste: 'Grease Trap Waste', qr: 'ABC123', tags: 'T1 T2',
  capacity: 1000, lat: -34.9285, lng: 138.6007, freqWeeks: 4, lastService: '2026-09-01T00:00:00.000Z', locationId: 'LO0001', companyId: 'CO0001',
  ...over,
})

export const pickup = (over: Partial<Pickup> = {}): Pickup => ({
  id: 'PK0001', deviceId: 'DV0001', vehicleId: 'VE0001', driverId: 'DR0001', companyId: 'CO0001',
  volume: 500, startAt: '2026-10-01T01:00:00.000Z', endAt: '2026-10-01T01:30:00.000Z', status: 'done',
  ...over,
})

export const transfer = (over: Partial<Transfer> = {}): Transfer => ({
  id: 'TR0001', fromVehicleId: 'VE0001', toVehicleId: 'VE0002', volume: 500, at: '2026-10-01T03:00:00.000Z', ...over,
})

export const unload = (over: Partial<Unload> = {}): Unload => ({
  id: 'UL0001', vehicleId: 'VE0002', facilityId: 'FA0001', volume: 500, at: '2026-10-01T05:00:00.000Z', ...over,
})

export const data = (over: Partial<AppData> = {}): AppData => ({
  seq: {}, companies: [], locations: [], devices: [device()], drivers: [], vehicles: [], facilities: [],
  pickups: [], transfers: [], unloads: [], reportedIssues: [], alertNotes: [], alertReads: [],
  ...over,
})
