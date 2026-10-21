import { dueWithin } from '../format'
import { device } from './fixtures'

const DAY = 864e5
// lastService such that the next service (4 weeks later) is `inDays` from now.
const dueIn = (inDays: number) => device({ freqWeeks: 4, lastService: new Date(Date.now() + (inDays - 28) * DAY + 3600e3).toISOString() })

describe('dueWithin', () => {
  it('includes devices due inside the window and overdue ones', () => {
    expect(dueWithin(dueIn(5), 7)).toBe(true)
    expect(dueWithin(dueIn(-10), 7)).toBe(true)
    expect(dueWithin(dueIn(20), 7)).toBe(false)
    expect(dueWithin(dueIn(20), 30)).toBe(true)
  })

  it('leaves out inactive devices and devices without a schedule', () => {
    expect(dueWithin(device({ ...dueIn(1), status: 'Inactive' }), 30)).toBe(false)
    expect(dueWithin(device({ freqWeeks: null }), 30)).toBe(false)
  })
})
