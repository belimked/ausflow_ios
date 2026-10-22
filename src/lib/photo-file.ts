import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import * as ImagePicker from 'expo-image-picker'
import { PHOTO_ATTEMPTS, fitsUpload, jpegDataUrl, resizeFor } from './photos'

export interface PreparedPhoto { uri: string; dataUrl: string; name: string }

export class PhotoTooLargeError extends Error {}

// Downscale and re-encode until the photo fits the server limit.
export async function preparePhoto(asset: { uri: string; width: number; height: number; fileName?: string | null }): Promise<PreparedPhoto> {
  for (const a of PHOTO_ATTEMPTS) {
    const ctx = ImageManipulator.manipulate(asset.uri)
    const size = resizeFor(asset.width, asset.height, a.edge)
    if (size) ctx.resize(size)
    const image = await ctx.renderAsync()
    const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: a.compress, base64: true })
    const dataUrl = jpegDataUrl(out.base64 || '')
    if (out.base64 && fitsUpload(dataUrl)) return { uri: out.uri, dataUrl, name: asset.fileName || 'photo.jpg' }
  }
  throw new PhotoTooLargeError('This photo is too large to upload. Try another one.')
}

// Returns null when the driver cancels or refuses permission.
export async function pickPhoto(source: 'camera' | 'library') {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return null
  }
  const result = source === 'camera'
    ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 })
    : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 })
  if (result.canceled || !result.assets?.length) return null
  return preparePhoto(result.assets[0])
}
