import { codeFor, qrRuns } from '../qr'

test('qr matrix has finder patterns and merged runs', () => {
  const q = qrRuns('DV4948126')
  expect(q.size).toBe(21)
  // Top-left finder: first row starts with a 7-module run.
  expect(q.rows[0]).toEqual({ y: 0, x: 0, w: 7 })
  expect(q.rows.every((r) => r.w >= 1 && r.x + r.w <= q.size)).toBe(true)
})

test('codes match what the scanner resolves', () => {
  expect(codeFor.device({ qr: null, ref: 'DV1' })).toBe('DV1')
  expect(codeFor.device({ qr: 'QR-9', ref: 'DV1' })).toBe('QR-9')
  expect(codeFor.vehicle({ qr: 'VH-0312', plate: '122 4SZ', id: 'VE0001' })).toBe('VH-0312')
})
