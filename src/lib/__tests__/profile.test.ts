import { findVehiclesByPlate, isTransport, joinVehicle } from '../profile'
import type { Company, Driver, Vehicle } from '../types'

const drivers: Driver[] = [
  { id: 'DR1', companyId: 'CO1', name: 'Ann', status: 'active' },
  { id: 'DR2', companyId: 'CO2', name: 'Ben', status: 'active' },
  { id: 'DR3', companyId: 'CO2', name: 'Cat', status: 'active' },
  { id: 'DR4', companyId: 'CO1', name: 'Old', status: 'inactive' },
]
const vehicle = (over: Partial<Vehicle>): Vehicle => ({ id: 'VE1', companyId: 'CO1', plate: '123 ABC', status: 'active', ...over })

describe('joinVehicle', () => {
  it('takes the company from the vehicle and the only active driver', () => {
    expect(joinVehicle({ drivers }, null, vehicle({}))).toEqual({ companyId: 'CO1', driverId: 'DR1', vehicleId: 'VE1' })
  })

  it('keeps the current driver when they belong to that company', () => {
    const current = { companyId: 'CO2', driverId: 'DR3', vehicleId: 'VE9' }
    expect(joinVehicle({ drivers }, current, vehicle({ id: 'VE2', companyId: 'CO2' })).driverId).toBe('DR3')
  })

  it('leaves the driver empty when the company has several and none is current', () => {
    const current = { companyId: 'CO1', driverId: 'DR1', vehicleId: 'VE1' }
    expect(joinVehicle({ drivers }, current, vehicle({ id: 'VE2', companyId: 'CO2' })).driverId).toBe('')
  })
})

describe('findVehiclesByPlate', () => {
  const companies: Company[] = [
    { id: 'CO1', name: 'Haul A', status: 'active', types: '["transport"]' },
    { id: 'CO2', name: 'Owner B', status: 'active', types: '["owner"]' },
    { id: 'CO3', name: 'Haul C', status: 'inactive', types: '["transport"]' },
  ]
  const vehicles = [
    vehicle({}),
    vehicle({ id: 'VE2', plate: '124 ABD', status: 'inactive' }),
    vehicle({ id: 'VE3', companyId: 'CO2', plate: '125 ABE' }),
    vehicle({ id: 'VE4', companyId: 'CO3', plate: '126 ABF' }),
  ]

  it('matches plates ignoring spaces and case, active transport vehicles only', () => {
    expect(findVehiclesByPlate({ vehicles, companies }, '123abc').map((v) => v.id)).toEqual(['VE1'])
    expect(findVehiclesByPlate({ vehicles, companies }, ' 12 ').map((v) => v.id)).toEqual(['VE1'])
  })

  it('returns nothing for an empty query', () => {
    expect(findVehiclesByPlate({ vehicles, companies }, '  ')).toEqual([])
  })
})

describe('isTransport', () => {
  it('reads the JSON types and defaults to transport', () => {
    expect(isTransport({ types: '["owner","transport"]' })).toBe(true)
    expect(isTransport({ types: '["owner"]' })).toBe(false)
    expect(isTransport({ types: '' })).toBe(true)
    expect(isTransport({ types: 'not json' })).toBe(true)
  })
})
