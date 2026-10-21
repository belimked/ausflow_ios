import { wasteCodeOf } from '../waste'

describe('wasteCodeOf', () => {
  it('reads a leading EPA code', () => {
    expect(wasteCodeOf('K110 Grease trap wastes')).toBe('K110')
  })
  it('maps known names case-insensitively', () => {
    expect(wasteCodeOf('Grease Trap Waste')).toBe('K110')
    expect(wasteCodeOf(' oily water ')).toBe('J120')
  })
  it('returns empty for unknown or missing text', () => {
    expect(wasteCodeOf('Something else')).toBe('')
    expect(wasteCodeOf(null)).toBe('')
  })
})
