import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, SectionTitle } from '@/components/ui'
import { useStore } from '@/lib/store'
import { colors } from '@/lib/theme'

// Old WasteID "My Details": change your name, email or password. The current password is always required.
export default function Details() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session, updateDetails } = useStore()
  const [name, setName] = useState(session?.user.displayName || '')
  const [email, setEmail] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [current, setCurrent] = useState('')
  const [busy, setBusy] = useState(false)

  const changed = name.trim() !== (session?.user.displayName || '') || !!email.trim() || !!next
  const problem = next && next.length < 6 ? 'New password must be at least 6 characters.'
    : next !== again ? 'The new passwords do not match.' : !name.trim() ? 'Enter your name.' : null

  async function save() {
    setBusy(true)
    try {
      await updateDetails({
        currentPassword: current,
        displayName: name.trim(),
        // Only sent when typed: the phone does not know the current email, and an empty value would clear it.
        ...(email.trim() ? { email: email.trim() } : {}),
        ...(next ? { newPassword: next } : {}),
      })
      Alert.alert('Details saved', next ? 'Use your new password next time you sign in, here and on the web.' : undefined)
      router.back()
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const field = (label: string, value: string, set: (v: string) => void, props: Partial<React.ComponentProps<typeof TextInput>> = {}) => (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput value={value} onChangeText={set} placeholderTextColor={colors.faint} style={s.input} autoCorrect={false} {...props} />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <SectionTitle title="Your details" />
        <Card style={s.group}>
          {field('Name', name, setName, { testID: 'details-name' })}
          <Divider />
          {field('New email (optional)', email, setEmail, { placeholder: 'Leave empty to keep the current one', keyboardType: 'email-address', autoCapitalize: 'none' })}
        </Card>

        <SectionTitle title="Change password (optional)" />
        <Card style={s.group}>
          {field('New password', next, setNext, { secureTextEntry: true, textContentType: 'newPassword' })}
          <Divider />
          {field('Repeat new password', again, setAgain, { secureTextEntry: true, textContentType: 'newPassword' })}
        </Card>

        <SectionTitle title="Confirm" />
        <Card style={s.group}>
          {field('Current password', current, setCurrent, { secureTextEntry: true, textContentType: 'password', testID: 'details-current' })}
        </Card>
        {problem && changed ? <Text style={s.problem}>{problem}</Text> : null}
        <Text style={s.hint}>Your username stays the same. These details are shared with the AusFlow web console.</Text>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="details-save" title="Save" icon="checkmark" onPress={save} loading={busy} disabled={!changed || !!problem || !current} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  group: { padding: 0, overflow: 'hidden' },
  field: { paddingHorizontal: 16, paddingVertical: 10 },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, letterSpacing: 0.3 },
  input: { fontSize: 17, color: colors.text, paddingVertical: 6 },
  problem: { color: colors.danger, fontSize: 14, fontWeight: '600', marginTop: 12, paddingHorizontal: 4 },
  hint: { color: colors.faint, fontSize: 13, marginTop: 12, paddingHorizontal: 4, lineHeight: 18 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
