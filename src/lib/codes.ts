import type { AppData, Device, Facility, Vehicle } from './types'

// QR labels encode "http://QR2id.net/?X@<code>"; some devices carry several tag codes.
export function codeOf(raw: string) {
  const text = raw.trim()
  return (text.includes('@') ? text.slice(text.lastIndexOf('@') + 1) : text).trim().toUpperCase()
}

export function findDeviceByCode(devices: Device[], raw: string) {
  const code = codeOf(raw)
  if (!code) return null
  return devices.find((d) =>
    d.ref.toUpperCase() === code || (d.qr || '').toUpperCase() === code ||
    (d.tags || '').toUpperCase().split(/\s+/).includes(code)) || null
}

export type Scanned =
  | { kind: 'device'; item: Device }
  | { kind: 'vehicle'; item: Vehicle }
  | { kind: 'facility'; item: Facility }

// One scanner for every sticker, like the old app: vehicle stickers (VH…) and facility plates (FA…) are matched on
// their qr field; anything else is looked up as a device.
export function resolveCode(d: Pick<AppData, 'devices' | 'vehicles' | 'facilities'>, raw: string): Scanned | null {
  const code = codeOf(raw)
  if (!code) return null
  const same = (qr?: string | null) => !!qr && qr.toUpperCase() === code
  const vehicle = d.vehicles.find((v) => same(v.qr))
  if (vehicle) return { kind: 'vehicle', item: vehicle }
  const facility = d.facilities.find((f) => same(f.qr))
  if (facility) return { kind: 'facility', item: facility }
  const device = findDeviceByCode(d.devices, raw)
  return device ? { kind: 'device', item: device } : null
}
