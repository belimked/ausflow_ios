// EPA waste codes used by the web console (web-prototype/src/store/wasteCodes.js). There is no waste-type table:
// waste is free text on the device, and these codes are only derived for display.
export const WASTE_CODES: Record<string, string> = {
  K100: 'Animal effluent and residues',
  K110: 'Grease trap wastes',
  K130: 'Sewage sludge and residues',
  J100: 'Waste oils, hydrocarbons, emulsions and transformer fluids',
  J120: 'Waste oil/water, hydrocarbon/water mixtures or emulsions',
  N205: 'Residues from industrial waste treatment/disposal operations',
  T100: 'Waste chemical substances from research, development or teaching activities',
}

const KNOWN: Record<string, string> = { 'grease trap waste': 'K110', 'oily water': 'J120', sewage: 'K130', 'waste oil': 'J100' }

export function wasteCodeOf(text?: string | null) {
  const value = String(text || '').trim()
  const code = /^([A-Z]\d{3})\b/.exec(value)?.[1]
  if (code) return code
  return KNOWN[value.toLowerCase()] || ''
}

export const DEFAULT_WASTE = 'Grease Trap Waste'
