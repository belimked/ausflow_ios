import { nextId } from '../ids'

describe('nextId', () => {
  it('starts at 0001 when nothing exists', () => {
    expect(nextId({ seq: {} }, 'PK', [])).toEqual({ id: 'PK0001', seq: { PK: 1 } })
  })

  it('continues from the server seq', () => {
    expect(nextId({ seq: { PK: 41 } }, 'PK', []).id).toBe('PK0042')
  })

  it('uses the highest existing id when another client is ahead of seq', () => {
    expect(nextId({ seq: { PK: 3 } }, 'PK', [{ id: 'PK0010' }, { id: 'PK0002' }]).id).toBe('PK0011')
  })

  it('ignores ids with another prefix and keeps other seq keys', () => {
    const r = nextId({ seq: { CL: 7 } }, 'PK', [{ id: 'TR0099' }])
    expect(r).toEqual({ id: 'PK0001', seq: { CL: 7, PK: 1 } })
  })
})
