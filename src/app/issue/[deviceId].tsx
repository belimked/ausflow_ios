import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PhotoPicker } from '@/components/PhotoPicker'
import { Button, Card, Divider, EmptyState, Icon, Row, SectionTitle } from '@/components/ui'
import { deviceTitle } from '@/lib/format'
import { ISSUE_CATEGORIES } from '@/lib/issues'
import type { PreparedPhoto } from '@/lib/photo-file'
import { useIndex, useStore } from '@/lib/store'
import { colors } from '@/lib/theme'
import type { IssueCategory } from '@/lib/types'

export default function ReportIssue() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const ix = useIndex()
  const { reportIssue } = useStore()
  const [category, setCategory] = useState<IssueCategory | null>(null)
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<PreparedPhoto[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const dev = ix.devices.get(deviceId)
  if (!dev) return <EmptyState icon="questionmark.circle" title="Device not found" />
  const loc = dev.locationId ? ix.locations.get(dev.locationId) : undefined
  const ready = !!category && (category !== 'other' || !!description.trim())

  async function submit() {
    if (!category || !dev) return
    try {
      setBusy('Reporting…')
      const { queued } = await reportIssue(dev.id, { category, description }, photos)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('Problem reported', queued
        ? 'You are offline. The report is saved on this phone and will be sent as soon as you are back online.'
        : photos.length ? 'The office has been notified. Photos are uploading in the background.' : 'The office has been notified and will follow it up.')
      router.back()
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not report the problem', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={s.intro}>Use this when you cannot service the device, or something about it needs attention.</Text>
        <Text style={s.device}>{deviceTitle(dev, loc)} · {dev.ref}</Text>

        <SectionTitle title="What's the problem?" />
        <Card style={s.group}>
          {(Object.keys(ISSUE_CATEGORIES) as IssueCategory[]).map((c, i) => (
            <View key={c}>{i > 0 && <Divider />}
              <Row testID={`issue-${c}`} title={ISSUE_CATEGORIES[c]} onPress={() => setCategory(c)} chevron={false}
                right={category === c ? <Icon name="checkmark.circle.fill" size={22} color={colors.primary} /> : <Icon name="circle" size={22} color={colors.border} />} />
            </View>
          ))}
        </Card>

        <SectionTitle title={category === 'other' ? 'Description' : 'Description (optional)'} />
        <Card style={{ padding: 0 }}>
          <TextInput testID="issue-description" value={description} onChangeText={setDescription} multiline maxLength={500}
            placeholder="e.g. car parked over the lid, site closed for renovation" placeholderTextColor={colors.faint} style={s.note} />
        </Card>

        <SectionTitle title="Photos (optional)" />
        <PhotoPicker photos={photos} onChange={setPhotos} />
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="issue-submit" title={busy || 'Report problem'} icon="exclamationmark.bubble.fill" kind="danger" onPress={submit} disabled={!ready} loading={!!busy} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21, paddingHorizontal: 4 },
  device: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10, paddingHorizontal: 4 },
  group: { padding: 0, overflow: 'hidden' },
  note: { minHeight: 96, padding: 14, fontSize: 16, color: colors.text, textAlignVertical: 'top' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
