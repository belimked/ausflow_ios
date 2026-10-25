import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Icon } from '@/components/ui'
import { resolveCode } from '@/lib/codes'
import { fmtL } from '@/lib/format'
import { scanAction, type ScanMode } from '@/lib/scan'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'

const FRAME = 260

const HINT: Record<ScanMode, string> = {
  any: 'Scan the QR label on a grease trap, a vehicle sticker or a facility plate',
  vehicle: 'Point the camera at the QR sticker on the vehicle',
  facility: 'Point the camera at the QR plate at the facility',
  transfer: 'Scan the sticker of the vehicle receiving the waste',
}
const TITLE: Record<ScanMode, string> = { any: 'Scan QR code', vehicle: 'Scan vehicle', facility: 'Scan facility', transfer: 'Transfer to…' }

export default function Scan() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ mode?: ScanMode }>()
  const mode: ScanMode = params.mode && params.mode in HINT ? params.mode : 'any'
  const { data, profile, viewMode } = useStore()
  const ix = useIndex()
  const [permission, requestPermission] = useCameraPermissions()
  const [torch, setTorch] = useState(false)
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const locked = useRef(false)

  function resolve(raw: string) {
    if (locked.current || !data) return
    locked.current = true
    const onBoard = profile ? ix.loads.get(profile.vehicleId) || 0 : 0
    // Console view: any sticker opens its record; driver actions (start pickup, change vehicle…) stay in the driver view.
    if (viewMode === 'admin' && mode === 'any') {
      const hit = resolveCode(data, raw)
      if (!hit) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
        setProblem(`Nothing found for “${raw.trim()}”`)
        setTimeout(() => { locked.current = false }, 1800)
        return
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      if (hit.kind === 'device') return router.replace(`/device/${hit.item.id}`)
      if (hit.kind === 'vehicle') return router.replace(`/vehicle/${hit.item.id}`)
      return router.replace({ pathname: '/directory', params: { tab: 'facilities' } })
    }
    const action = scanAction(resolveCode(data, raw), raw, mode, { vehicleId: profile?.vehicleId, onBoard, companyId: profile?.companyId })
    if ('problem' in action) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      setProblem(action.problem)
      setTimeout(() => { locked.current = false }, 1800)
      return
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    switch (action.go) {
      case 'device': return router.replace(`/device/${action.id}`)
      case 'join': return router.replace({ pathname: '/setup', params: { vehicleId: action.vehicleId } })
      case 'offload': return router.replace({ pathname: '/offload', params: { facilityId: action.facilityId } })
      case 'transfer': return router.replace({ pathname: '/transfer', params: { toVehicleId: action.vehicleId } })
      case 'joinOrTransfer': {
        const plate = ix.vehicles.get(action.vehicleId)?.plate || 'this vehicle'
        return Alert.alert(plate, `You have ${fmtL(onBoard)} on board. Change to ${plate}, or transfer your waste into it?`, [
          { text: 'Cancel', style: 'cancel', onPress: () => { locked.current = false } },
          { text: 'Change vehicle', onPress: () => router.replace({ pathname: '/setup', params: { vehicleId: action.vehicleId } }) },
          { text: 'Transfer waste', onPress: () => router.replace({ pathname: '/transfer', params: { toVehicleId: action.vehicleId } }) },
        ])
      }
    }
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
        {manual && <ManualEntry code={code} setCode={setCode} onSubmit={() => resolve(code)} error={problem} mode={mode} />}
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
          <Text style={s.hint}>{HINT[mode]}</Text>
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
        <Text style={s.topTitle}>{TITLE[mode]}</Text>
        <Pressable onPress={() => setTorch((t) => !t)} hitSlop={10} style={[s.round, torch && { backgroundColor: '#fff' }]}>
          <Icon name={torch ? 'flashlight.on.fill' : 'flashlight.off.fill'} size={18} color={torch ? colors.text : '#fff'} />
        </Pressable>
      </View>

      <View style={[s.bottom, { paddingBottom: insets.bottom + 16 }]}>
        {manual ? (
          <ManualEntry code={code} setCode={setCode} onSubmit={() => resolve(code)} error={problem} mode={mode} onCancel={() => setManual(false)} />
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

const MANUAL: Record<ScanMode, string> = {
  any: 'A device QR code, tag ID or ref (e.g. DV539135), a vehicle sticker code (VH…) or a facility plate code (FA…).',
  vehicle: 'The code printed under the vehicle QR sticker (VH…).',
  facility: 'The code printed under the facility QR plate (FA…).',
  transfer: 'The sticker code of the receiving vehicle (VH…).',
}

function ManualEntry({ code, setCode, onSubmit, error, mode, onCancel }: {
  code: string; setCode: (v: string) => void; onSubmit: () => void; error: string | null; mode: ScanMode; onCancel?: () => void
}) {
  return (
    <KeyboardAvoidingView behavior="padding" style={s.sheet}>
      <Text style={s.sheetTitle}>Enter code</Text>
      <Text style={s.sheetSub}>
        {MANUAL[mode]}
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
