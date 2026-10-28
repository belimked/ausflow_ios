import { lastServiceCompanies, servicedBy } from '../servicedBy'
import type { Pickup } from '../types'

const pick = (id: string, over: Partial<Pickup> = {}): Pickup => ({ id, deviceId: 'DV1', status: 'done', companyId: 'A', startAt: '2026-01-01', endAt: '2026-01-02', ...over })

test('latest completed end time wins, then latest start time, regardless of input order', () => {
  const rows = [pick('new', { companyId: 'B', endAt: '2026-03-01', startAt: '2026-02-28' }),
    pick('old', { endAt: '2026-02-01' }), pick('tie', { companyId: 'C', endAt: '2026-03-01', startAt: '2026-02-27' })]
  expect(servicedBy(lastServiceCompanies(rows), 'DV1')).toBe('B')
  expect(servicedBy(lastServiceCompanies(rows.reverse()), 'DV1')).toBe('B')
})

test('ongoing, incomplete and unrelated pickups do not assign a device', () => {
  const map = lastServiceCompanies([pick('ongoing', { status: 'ongoing', companyId: 'Z', endAt: '2026-04-01' }),
    pick('missing-end', { deviceId: 'DV2', endAt: null }), pick('no-device', { deviceId: null }),
    pick('unassigned', { deviceId: 'DV3', companyId: null, endAt: '2026-05-01' }),
    pick('previous', { deviceId: 'DV3', companyId: 'A' })])
  expect(map.get('DV1')).toBeUndefined()
  expect(map.get('DV2')).toBeUndefined()
  expect(map.get('DV3')).toBeUndefined()
  expect(servicedBy(map, 'DV4')).toBeNull()
})
