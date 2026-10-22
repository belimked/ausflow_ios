import { codeOf, findDeviceByCode, resolveCode } from '../codes'
import { device } from './fixtures'

describe('resolveCode', () => {
  const d = {
    devices: [device()],
    vehicles: [{ id: 'VE0001', plate: '123 ABC', qr: 'VHABCDEFGHIJ', status: 'active' }],
    facilities: [{ id: 'FA0001', name: 'Bolivar WWTP', qr: 'FAKLMNOPQRST', status: 'active' }],
  }

  it('recognises vehicle stickers, facility plates and devices', () => {
    expect(resolveCode(d, 'vhabcdefghij')).toMatchObject({ kind: 'vehicle', item: { id: 'VE0001' } })
    expect(resolveCode(d, 'http://QR2id.net/?X@FAKLMNOPQRST')).toMatchObject({ kind: 'facility', item: { id: 'FA0001' } })
    expect(resolveCode(d, 'DV539135')).toMatchObject({ kind: 'device', item: { id: 'DV0001' } })
  })

  it('returns null when nothing matches', () => {
    expect(resolveCode(d, 'VH0000000000')).toBeNull()
    expect(resolveCode(d, '')).toBeNull()
  })
})

describe('codeOf', () => {
  it('takes the part after the last @ of a QR2id URL', () => {
    expect(codeOf('http://QR2id.net/?X@abc123')).toBe('ABC123')
  })
  it('trims and upper-cases plain codes', () => {
    expect(codeOf('  dv539135 ')).toBe('DV539135')
  })
})

describe('findDeviceByCode', () => {
  const devices = [device(), device({ id: 'DV0002', ref: 'DV000002', qr: null, tags: null })]

  it('matches by ref, qr and any tag', () => {
    expect(findDeviceByCode(devices, 'dv539135')?.id).toBe('DV0001')
    expect(findDeviceByCode(devices, 'http://QR2id.net/?X@ABC123')?.id).toBe('DV0001')
    expect(findDeviceByCode(devices, 't2')?.id).toBe('DV0001')
    expect(findDeviceByCode(devices, 'DV000002')?.id).toBe('DV0002')
  })

  it('returns null for unknown or empty codes', () => {
    expect(findDeviceByCode(devices, 'nope')).toBeNull()
    expect(findDeviceByCode(devices, '   ')).toBeNull()
  })
})
