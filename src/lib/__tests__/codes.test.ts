import { codeOf, findDeviceByCode } from '../codes'
import { device } from './fixtures'

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
