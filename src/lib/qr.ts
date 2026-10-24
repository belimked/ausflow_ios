import QRCode from 'qrcode'

// QR matrix for a code string, as rows of horizontal runs (start column + length) so it can be drawn with a
// handful of Views per row instead of one per module. Pure JS: no native dependency.
export interface QrRuns { size: number; rows: { y: number; x: number; w: number }[] }

export function qrRuns(text: string, level: 'L' | 'M' | 'Q' | 'H' = 'M'): QrRuns {
  const q = QRCode.create(text, { errorCorrectionLevel: level })
  const size = q.modules.size
  const rows: QrRuns['rows'] = []
  for (let y = 0; y < size; y++) {
    let x = 0
    while (x < size) {
      if (q.modules.get(y, x)) {
        let x1 = x
        while (x1 + 1 < size && q.modules.get(y, x1 + 1)) x1++
        rows.push({ y, x, w: x1 - x + 1 })
        x = x1 + 1
      } else x++
    }
  }
  return { size, rows }
}

// What each sticker encodes, matching what the scanner looks up (lib/codes.ts): vehicles and facilities by their
// qr field, devices by qr or ref. Drivers have no code on the backend yet; the badge shows the driver id.
export const codeFor = {
  device: (d: { qr?: string | null; ref: string }) => d.qr || d.ref,
  vehicle: (v: { qr?: string | null; plate: string; id: string }) => v.qr || v.id,
  facility: (f: { qr?: string | null; id: string }) => f.qr || f.id,
  driver: (d: { id: string }) => `DRV-${d.id}`,
}
