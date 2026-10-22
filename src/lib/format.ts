import type { Device, Location } from './types'

const DAY = 864e5
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad = (n: number) => String(n).padStart(2, '0')

export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

export function fmtDate(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`
}

export function fmtTime(s?: string | null) {
  if (!s) return '—'
  const d = new Date(s)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fmtDay(s?: string | null) {
  if (!s) return '—'
  const t = new Date(s).getTime()
  const today = startOfDay()
  if (t >= today) return 'Today'
  if (t >= today - DAY) return 'Yesterday'
  const d = new Date(s)
  return `${DAYS[d.getDay()]} ${fmtDate(s)}`
}

export const fmtDateTime = (s?: string | null) => (s ? `${fmtDay(s)}, ${fmtTime(s)}` : '—')

export function fmtDuration(fromIso: string, to = Date.now()) {
  const mins = Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 60000))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  return h < 24 ? `${h} h ${mins % 60} min` : `${Math.floor(h / 24)} d ${h % 24} h`
}

export const fmtL = (v?: number | null) => (v == null ? '—' : `${Math.round(v).toLocaleString('en-AU')} L`)
export const fmtM = (v?: number | null) => (v == null ? 'No GPS' : v >= 1000 ? `${(v / 1000).toFixed(1)} km` : `${Math.round(v)} m`)

export function nextService(d: Device) {
  if (!d.lastService || !d.freqWeeks) return null
  return new Date(new Date(d.lastService).getTime() + d.freqWeeks * 7 * DAY).toISOString()
}

export type DueState = 'overdue' | 'soon' | 'ok' | 'unknown'

export function dueState(d: Device): { state: DueState; label: string; days: number } {
  const n = nextService(d)
  if (d.status !== 'Active' || !n) return { state: 'unknown', label: d.status !== 'Active' ? d.status : 'No schedule', days: 0 }
  const days = Math.ceil((new Date(n).getTime() - Date.now()) / DAY)
  if (days < 0) {
    const late = -days
    return { state: 'overdue', label: late < 14 ? `${late} d overdue` : `${Math.floor(late / 7)} wk overdue`, days }
  }
  if (days <= 7) return { state: 'soon', label: days === 0 ? 'Due today' : `Due in ${days} d`, days }
  return { state: 'ok', label: `Due ${fmtDate(n)}`, days }
}

// Old WasteID service list "Service Due Before": active devices whose next service falls within `days`
// from today, overdue ones included.
export function dueWithin(d: Device, days: number) {
  const s = dueState(d)
  return s.state !== 'unknown' && s.days <= days
}

export const deviceTitle = (d?: Device | null, loc?: Location | null) => d?.aka || loc?.name || d?.ref || 'Unknown device'

export function addressOf(loc?: Location | null) {
  if (!loc) return ''
  const line = [loc.address1, loc.address2].filter(Boolean).join(', ')
  const area = [loc.suburb, loc.state, loc.postcode].filter(Boolean).join(' ')
  return [line, area].filter(Boolean).join(', ')
}

export const initials = (name: string) =>
  name.replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?'

export const normName = (s?: string | null) => (s || '').replace(/\s+/g, ' ').trim()
