// Photo upload rules shared with the server (web-prototype/server/app.js): base64 data URLs of at most
// 1.5 M characters (~1.1 MB). Like the web console, photos are downscaled to 1600 px JPEG first; if one is
// still too big it is retried smaller.
export const MAX_PHOTO_CHARS = 1_500_000

export const PHOTO_ATTEMPTS = [
  { edge: 1600, compress: 0.82 },
  { edge: 1200, compress: 0.7 },
  { edge: 900, compress: 0.6 },
] as const

// Resize so the longest edge is at most `edge`; null when the image is already small enough.
export function resizeFor(width: number, height: number, edge: number): { width: number } | { height: number } | null {
  if (Math.max(width, height) <= edge) return null
  return width >= height ? { width: edge } : { height: edge }
}

export const jpegDataUrl = (base64: string) => `data:image/jpeg;base64,${base64}`

export const fitsUpload = (dataUrl: string) => dataUrl.length <= MAX_PHOTO_CHARS

// Server-side PHOTO_KINDS: which entity types accept photos, and with which kind.
export const PHOTO_TARGET = {
  issue: { type: 'issue', kind: 'photo' }, device: { type: 'device', kind: 'device' },
  // Taken when finishing a pickup (old WasteID consignment photo).
  pickupAfter: { type: 'pickup', kind: 'after' },
} as const
