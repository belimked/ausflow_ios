import { createOutbox } from '../outbox'
import { data, pickup, profile } from './fixtures'

const at = '2026-10-21T02:00:00.000Z'

function setup(d = data()) {
  const calls: string[] = []
  const deps = {
    fresh: jest.fn(async () => { calls.push('fresh'); return d }),
    send: jest.fn(async () => { calls.push('send') }),
    reload: jest.fn(async () => { calls.push('reload') }),
  }
  return { calls, deps, outbox: createOutbox(deps) }
}

describe('createOutbox (online)', () => {
  it('plans against fresh state, sends, then reloads', async () => {
    const { calls, deps, outbox } = setup()
    const p = await outbox.submit<{ id: string }>({ kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: null })
    expect(p.id).toBe('PK0001')
    expect(calls).toEqual(['fresh', 'send', 'reload'])
    expect(deps.send).toHaveBeenCalledWith(expect.objectContaining({ upserts: { pickups: [p] } }))
  })

  it('sends nothing when the command is a no-op', async () => {
    const { calls, outbox } = setup(data({ pickups: [pickup()] }))
    await outbox.submit({ kind: 'cancelPickup', at, pickupId: 'PK0001' })
    expect(calls).toEqual(['fresh'])
  })

  it('does not send when a rule fails', async () => {
    const { deps, outbox } = setup(data({ devices: [] }))
    await expect(outbox.submit({ kind: 'startPickup', at, deviceId: 'DV0001', profile, coords: null })).rejects.toThrow('This device no longer exists.')
    expect(deps.send).not.toHaveBeenCalled()
  })
})
