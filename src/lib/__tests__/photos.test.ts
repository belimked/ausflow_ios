import { MAX_PHOTO_CHARS, PHOTO_ATTEMPTS, fitsUpload, jpegDataUrl, resizeFor } from '../photos'

describe('resizeFor', () => {
  it('limits the longest edge and keeps the ratio by setting one side', () => {
    expect(resizeFor(4032, 3024, 1600)).toEqual({ width: 1600 })
    expect(resizeFor(3024, 4032, 1600)).toEqual({ height: 1600 })
  })
  it('leaves small images alone', () => {
    expect(resizeFor(1200, 900, 1600)).toBeNull()
    expect(resizeFor(1600, 1600, 1600)).toBeNull()
  })
})

describe('upload size', () => {
  it('builds a JPEG data URL the server accepts', () => {
    expect(jpegDataUrl('QUJD')).toBe('data:image/jpeg;base64,QUJD')
  })
  it('accepts data URLs up to the server limit', () => {
    expect(fitsUpload('x'.repeat(MAX_PHOTO_CHARS))).toBe(true)
    expect(fitsUpload('x'.repeat(MAX_PHOTO_CHARS + 1))).toBe(false)
  })
  it('starts with the web console settings and only gets smaller', () => {
    expect(PHOTO_ATTEMPTS[0]).toEqual({ edge: 1600, compress: 0.82 })
    for (let i = 1; i < PHOTO_ATTEMPTS.length; i++) {
      expect(PHOTO_ATTEMPTS[i].edge).toBeLessThan(PHOTO_ATTEMPTS[i - 1].edge)
      expect(PHOTO_ATTEMPTS[i].compress).toBeLessThan(PHOTO_ATTEMPTS[i - 1].compress)
    }
  })
})
