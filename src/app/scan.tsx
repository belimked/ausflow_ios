import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Icon } from '@/components/ui'
import { codeOf, resolveCode } from '@/lib/codes'
import { useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'

const FRAME = 260

export default function Scan() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // mode=vehicle comes from the driver & vehicle screen and only accepts vehicle stickers.
  const { mode } = useLocalSearchParams<{ mode?: 'vehicle' }>()
  const vehicleOnly = mode === 'vehicle'
  const { data } = useStore()
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const locked = useRef(false)

  function resolve(raw: string) {
    if (locked.current || !data) return
    locked.current = true
    const hit = resolveCode(data, raw)
    if (hit?.kind === 'vehicle') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace({ pathname: '/setup', params: { vehicleId: hit.item.id } })
      return
    }
    if (hit?.kind === 'device' && !vehicleOnly) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace(`/device/${hit.item.id}`)
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    if (vehicleOnly && hit) setProblem('That is not a vehicle sticker.')
    else if (hit?.kind === 'facility') setProblem(`${hit.item.name} is a treatment facility. Offloading is not available in this version yet.`)
    else setProblem(`No ${vehicleOnly ? 'vehicle' : 'device or vehicle'} found for “${codeOf(raw) || raw}”`)
    setTimeout(() => { locked.current = false }, 1800)
  }

  const close = (
    <Pressable onPress={() => router.back()} hitSlop={10} style={s.round}>
      <Icon name="xmark" size={18} color="#fff" />
    </Pressable>
  )

  if (!permission) return <View style={s.black} />

  if (!permission.granted) {
    return (
      <View style={[s.black, s.center, { paddingTop: insets.top }]}>
        <View style={[s.topBar, { top: insets.top + 8 }]}>{close}</View>
        <View style={s.permIcon}><Icon name="camera.fill" size={34} color="#fff" /></View>
        <Text style={s.permTitle}>Camera access needed</Text>
        <Text style={s.permText}>AusFlow uses the camera to scan the QR label on each grease trap.</Text>
        <Button
          title={permission.canAskAgain ? 'Allow camera' : 'Open Settings'} icon="camera"
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        <Button title="Enter code instead" kind="ghost" onPress={() => setManual(true)} style={{ alignSelf: 'stretch' }} />
        {manual && <ManualEntry code={code} setCode={setCode} onSubmit={() => resolve(code)} error={problem} vehicleOnly={vehicleOnly} />}
      </View>
    )
  }

  return (
    <View style={s.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={manual ? undefined : ({ data: raw }) => resolve(raw)}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={s.mask} />
        <View style={{ flexDirection: 'row', height: FRAME }}>
          <View style={s.mask} />
          <View style={s.frame}>
            <View style={[s.corner, { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 22 }]} />
            <View style={[s.corner, { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 22 }]} />
            <View style={[s.corner, { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 22 }]} />
            <View style={[s.corner, { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 22 }]} />
          </View>
          <View style={s.mask} />
        </View>
        <View style={[s.mask, { alignItems: 'center', paddingTop: 28, paddingHorizontal: 32 }]}>
          <Text style={s.hint}>{vehicleOnly ? 'Point the camera at the QR sticker on the vehicle' : 'Scan the QR label on a grease trap or a vehicle sticker'}</Text>
          {problem && !manual ? (
            <View style={s.toast}>
              <Icon name="exclamationmark.triangle.fill" size={16} color="#FFB224" />
              <Text style={s.toastText} numberOfLines={3}>{problem}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[s.topBar, { top: insets.top + 8 }]}>
        {close}
        <Text style={s.topTitle}>{vehicleOnly ? 'Scan vehicle' : 'Scan QR code'}</Text>
        <Pressable onPress={() => setTorch((t) => !t)} hitSlop={10} style={[s.round, torch && { backgroundColor: '#fff' }]}>
          <Icon name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? colors.text : '#fff'} />
        </Pressable>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {manual ? (
          <ManualEntry code={code} setCode={setCode} onSubmit={() => resolve(code)} error={problem} vehicleOnly={vehicleOnly} onCancel={() => setManual(false)} />
        ) : (
          <Pressable testID="scan-manual" onPress={() => setManual(true)} style={s.manualBtn}>
            <Icon name="keyboard" size={18} color="#fff" />
            <Text style={s.manualText}>Enter code manually</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

function ManualEntry({ code, setCode, onSubmit, error, vehicleOnly, onCancel }: {
  code: string; setCode: (v: string) => void; onSubmit: () => void; error: string | null; vehicleOnly: boolean; onCancel?: () => void
}) {
  return (
    <KeyboardAvoidingView behavior="padding" style={s.sheet}>
      <Text style={s.sheetTitle}>{vehicleOnly ? 'Enter vehicle code' : 'Enter code'}</Text>
      <Text style={s.sheetSub}>
        {vehicleOnly ? 'The code printed under the vehicle QR sticker (VH…).' : 'A device QR code, tag ID or ref (e.g. DV539135), or a vehicle sticker code (VH…).'}
      </Text>
      <TextInput
        testID="scan-code" value={code} onChangeText={setCode} autoFocus autoCapitalize="characters" autoCorrect={false}
        placeholder="Code" placeholderTextColor={colors.faint} style={s.codeInput} returnKeyType="search" onSubmitEditing={onSubmit} />
      {error ? <Text style={s.sheetError}>{error}</Text> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        {onCancel ? <Button title="Cancel" kind="secondary" onPress={onCancel} style={{ flex: 1 }} size="md" /> : null}
        <Button testID="scan-find" title="Find" icon="magnifyingglass" onPress={onSubmit} disabled={!code.trim()} style={{ flex: 2 }} size="md" />
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  mask: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: 46, height: 46, borderColor: '#fff' },
  hint: { color: '#fff', fontSize: 16, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.7)' },
  toastText: { color: '#fff', fontSize: 14, fontWeight: '600', flexShrink: 1 },
  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 16, right: 16, bottom: 0 },
  manualBtn: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 20, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.18)' },
  manualText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  sheet: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 20, alignSelf: 'stretch', marginTop: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  sheetSub: { fontSize: 14, color: colors.muted, marginTop: 4 },
  sheetError: { color: colors.danger, fontSize: 14, fontWeight: '600', marginTop: 8 },
  codeInput: { marginTop: 14, height: 52, borderRadius: radius.md, backgroundColor: colors.bg, paddingHorizontal: 14, fontSize: 18, fontWeight: '600', letterSpacing: 1, color: colors.text, borderWidth: 1, borderColor: colors.border },
  permIcon: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  permTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginTop: 20 },
  permText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', marginTop: 8, lineHeight: 21 },
})
