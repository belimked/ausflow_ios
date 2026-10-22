import { CommandError, planCommand } from '../commands'
import { issueLabel, openIssues } from '../issues'
import type { ReportedIssue } from '../types'
import { data } from './fixtures'

const at = '2026-10-21T02:00:00.000Z'
const issue = (over: Partial<ReportedIssue>): ReportedIssue => ({
  id: 'RI0001', deviceId: 'DV0001', category: 'no_access', at: '2026-10-01T00:00:00.000Z', status: 'open', source: 'App', ...over,
})

describe('openIssues', () => {
  it('lists open issues of the device, newest first', () => {
    const list = [
      issue({}),
      issue({ id: 'RI0002', at: '2026-10-05T00:00:00.000Z' }),
      issue({ id: 'RI0003', status: 'resolved' }),
      issue({ id: 'RI0004', deviceId: 'DV0002' }),
    ]
    expect(openIssues(list, 'DV0001').map((i) => i.id)).toEqual(['RI0002', 'RI0001'])
  })
})

describe('issueLabel', () => {
  it('uses the console labels and falls back to the raw value', () => {
    expect(issueLabel('baffle_damaged')).toBe('Baffle damaged')
    expect(issueLabel('something_new')).toBe('something_new')
  })
})

describe('reportIssue', () => {
  const report = (over: { category?: string; description?: string } = {}, d = data({ seq: { RI: 10 } })) =>
    planCommand(d, { kind: 'reportIssue', at, deviceId: 'DV0001', category: (over.category ?? 'no_access') as never, description: over.description ?? '  car on lid ', userName: 'Sam' })

  it('creates an open App issue with the next RI id', () => {
    const plan = report()
    expect(plan.result).toEqual({
      id: 'RI0011', deviceId: 'DV0001', category: 'no_access', description: 'car on lid',
      reportedBy: 'Sam', at, status: 'open', source: 'App',
    })
    expect(plan.sync).toEqual({ upserts: { reportedIssues: [plan.result] }, seq: { RI: 11 } })
  })

  it('stores an empty description as null', () => {
    expect((report({ description: ' ' }).result as ReportedIssue).description).toBeNull()
  })

  it.each([
    ['the device is gone', {}, data({ devices: [] }), 'This device no longer exists.'],
    ['the category is unknown', { category: 'flood' }, undefined, 'Choose what the problem is.'],
    ['"other" has no description', { category: 'other', description: '  ' }, undefined, 'Describe the problem.'],
  ])('refuses when %s', (_, over, d, message) => {
    expect(() => report(over, d)).toThrow(new CommandError(message))
  })
})
