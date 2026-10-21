import type { Device } from './types'

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
