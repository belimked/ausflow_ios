import { useState } from 'react'
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { pickPhoto, type PreparedPhoto } from '@/lib/photo-file'
import { colors, radius } from '@/lib/theme'
import { Icon } from './ui'

// Photos are prepared (downscaled, base64) as soon as they are picked and uploaded by the screen on submit.
export function PhotoPicker({ photos, onChange, max = 5 }: { photos: PreparedPhoto[]; onChange: (p: PreparedPhoto[]) => void; max?: number }) {
  const [busy, setBusy] = useState(false)

  async function add(source: 'camera' | 'library') {
    setBusy(true)
    try {
      const p = await pickPhoto(source)
      if (p) onChange([...photos, p])
    } catch (e) {
      Alert.alert('Could not add the photo', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const full = photos.length >= max
  return (
    <View>
      {photos.length ? (
        <View style={s.thumbs}>
          {photos.map((p, i) => (
            <View key={p.uri + i} style={s.thumb}>
              <Image source={{ uri: p.uri }} style={s.image} />
              <Pressable hitSlop={8} onPress={() => onChange(photos.filter((_, j) => j !== i))} style={s.remove}>
                <Icon name="xmark" size={11} color="#fff" weight="bold" />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
      <View style={s.buttons}>
        <Pressable testID="photo-camera" disabled={busy || full} onPress={() => add('camera')} style={[s.button, (busy || full) && s.off]}>
          <Icon name="camera.fill" size={16} color={colors.primary} />
          <Text style={s.buttonText}>{busy ? 'Processing…' : 'Take photo'}</Text>
        </Pressable>
        <Pressable testID="photo-library" disabled={busy || full} onPress={() => add('library')} style={[s.button, (busy || full) && s.off]}>
          <Icon name="photo.on.rectangle" size={16} color={colors.primary} />
          <Text style={s.buttonText}>Library</Text>
        </Pressable>
      </View>
      {full ? <Text style={s.hint}>Up to {max} photos.</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  thumb: { width: 76, height: 76 },
  image: { width: 76, height: 76, borderRadius: radius.sm, backgroundColor: colors.bg },
  remove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  buttons: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: radius.md, backgroundColor: colors.primarySoft },
  buttonText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  off: { opacity: 0.5 },
  hint: { fontSize: 12, color: colors.faint, marginTop: 8 },
})
