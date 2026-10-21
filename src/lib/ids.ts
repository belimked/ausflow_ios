import type { AppData } from './types'

// Record id prefixes shared with the web console (web-prototype/src/store/seed.js).
export const PREFIX = { pickup: 'PK', transfer: 'TR', unload: 'UL', issue: 'RI', changeLog: 'CL' } as const

export function nextId(data: Pick<AppData, 'seq'>, prefix: string, rows: { id: string }[]) {
  // The server only keeps the highest seq it has seen, so also check existing ids in case another client lagged.
  const re = new RegExp(`^${prefix}(\\d+)$`)
  let n = data.seq[prefix] || 0
  for (const r of rows) {
    const m = re.exec(r.id)
    if (m) n = Math.max(n, Number(m[1]))
  }
  n += 1
  return { id: prefix + String(n).padStart(4, '0'), seq: { ...data.seq, [prefix]: n } }
}
