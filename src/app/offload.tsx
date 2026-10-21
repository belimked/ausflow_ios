import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, EmptyState, Icon, Row, SectionTitle, toneColor } from '@/components/ui'
import { LOCATION_FLAG_METRES } from '@/lib/config'
import { UNLOAD_DIFF_WARN, cycleWaste, nearbyFacilities, volumeGap } from '@/lib/delivery'
import { fmtL, fmtM } from '@/lib/format'
import { currentCoords, distanceM, quietCoords } from '@/lib/geo'
import { currentCycle } from '@/lib/load'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'
import type { Coords, Unload } from '@/lib/types'
import { DEFAULT_WASTE, wasteCodeOf, wasteOptions } from '@/lib/waste'

// Old WasteID "Offload Waste / Deliver Waste": choose the facility (scan its plate or pick a nearby one),
// confirm the vehicle and the volume, and record the delivery.
export default function Offload() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ facilityId?: string }>()
  const { data, profile, unload } = useStore()
  const ix = useIndex()
  const [facilityId, setFacilityId] = useState(params.facilityId || '')
  const [here, setHere] = useState<Coords | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Unload | null>(null)

  useEffect(() => { quietCoords().then(setHere) }, [])

  const vehicle = profile ? ix.vehicles.get(profile.vehicleId) : undefined
  const onBoard = Math.max(0, vehicle ? ix.loads.get(vehicle.id) || 0 : 0)
  const cycle = useMemo(() => (data && vehicle ? currentCycle(data, vehicle.id) : null), [data, vehicle])
  const [volume, setVolume] = useState(onBoard ? String(Math.round(onBoard)) : '')
  const [waste, setWaste] = useState(cycleWaste(cycle) || DEFAULT_WASTE)

  if (done) return <Delivered unload={done} />
  if (!profile || !vehicle) {
    return <EmptyState icon="truck.box" title="Choose your vehicle first" message="Deliveries are recorded against the vehicle you are driving."
      action={<Button title="Choose driver & vehicle" onPress={() => router.replace('/setup')} size="md" />} />
  }

  const facility = facilityId ? ix.facilities.get(facilityId) : undefined
  const nearby = nearbyFacilities(data?.facilities || [], here).slice(0, 6)
  const away = facility ? distanceM(here?.lat, here?.lng, facility.lat, facility.lng) : null
  const v = Number(volume.replace(/[^\d.]/g, ''))
  const gap = volumeGap(onBoard, v)
  const ready = !!facility && v > 0

  async function deliver() {
    if (!facility) return
    try {
      setBusy('Getting your location…')
      const coords = await currentCoords()
      setBusy('Saving…')
      const u = await unload({ facilityId: facility.id, volume: v, waste, coords })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setDone(u)
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not record the delivery', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const warn = toneColor('warning')
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <SectionTitle title="Vehicle" />
        <Card style={s.group}>
          <Row icon="truck.box.fill" title={vehicle.plate} subtitle={`${fmtL(onBoard)} on board${vehicle.tank ? ` · ${fmtL(vehicle.tank)} tank` : ''}`} />
          <Divider />
          <Row icon="arrow.triangle.2.circlepath" tone="neutral" title="Wrong vehicle?" subtitle="Change to the vehicle you are discharging from" onPress={() => router.push('/setup')} />
        </Card>

        <SectionTitle title="Treatment facility" />
        <Card style={s.group}>
          {facility ? (
            <Row testID="offload-facility" icon="building.columns.fill" title={facility.name}
              subtitle={[facility.address, away != null ? `${fmtM(away)} away` : null].filter(Boolean).join(' · ')}
              right={<Pressable hitSlop={8} onPress={() => setFacilityId('')}><Text style={s.link}>Change</Text></Pressable>} />
          ) : (
            <>
              <Row testID="offload-scan-plate" icon="qrcode.viewfinder" title="Scan facility plate"
                onPress={() => router.replace({ pathname: '/scan', params: { mode: 'facility' } })} />
              {nearby.map(({ facility: f, distance }) => (
                <View key={f.id}><Divider />
                  <Row icon="building.columns" tone="neutral" title={f.name} subtitle={[f.address, distance != null ? `${fmtM(distance)} away` : null].filter(Boolean).join(' · ')}
                    onPress={() => setFacilityId(f.id)} />
                </View>
              ))}
              {!nearby.length ? <><Divider /><EmptyState icon="building.columns" title="No facilities" message="Facilities are managed in the web console." /></> : null}
            </>
          )}
        </Card>
        {away != null && away > LOCATION_FLAG_METRES ? (
          <View style={[s.banner, { backgroundColor: warn.bg }]}>
            <Icon name="location.slash.fill" size={18} color={warn.fg} />
            <Text style={[s.bannerText, { color: warn.fg }]}>You are {fmtM(away)} from this facility. Check you picked the right one before delivering.</Text>
          </View>
        ) : null}

        <SectionTitle title="Volume delivered" />
        <Card>
          <View style={s.volumeBox}>
            <TextInput testID="offload-volume" value={volume} onChangeText={(t) => setVolume(t.replace(/[^\d]/g, ''))} keyboardType="number-pad"
              placeholder="0" placeholderTextColor={colors.faint} style={s.volumeInput} maxLength={6} />
            <Text style={s.unit}>L</Text>
          </View>
          <Text style={[s.hint, gap != null && gap > UNLOAD_DIFF_WARN && { color: colors.warning }]}>
            {gap != null && gap > UNLOAD_DIFF_WARN
              ? `Differs from the ${fmtL(onBoard)} recorded on board by ${Math.round(gap * 100)} %. Check the figure before delivering.`
              : `${fmtL(onBoard)} recorded on board`}
          </Text>
        </Card>

        <SectionTitle title="Waste type" />
        <View style={s.wastes}>
          {wasteOptions(cycleWaste(cycle)).map((w) => {
            const on = w.toLowerCase() === waste.toLowerCase()
            const code = wasteCodeOf(w)
            return (
              <Pressable key={w} onPress={() => setWaste(w)} style={[s.waste, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[s.wasteText, on && { color: '#fff' }]}>{w}</Text>
                {code ? <Text style={[s.wasteCode, on && { color: 'rgba(255,255,255,0.8)' }]}>{code}</Text> : null}
              </Pressable>
            )
          })}
        </View>
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="offload-submit" kind="success" icon="arrow.down.to.line" onPress={deliver} disabled={!ready} loading={!!busy}
          title={busy || (!facility ? 'Choose a facility' : v > 0 ? `Deliver ${v.toLocaleString('en-AU')} L` : 'Enter the volume')} />
      </View>
    </View>
  )
}

function Delivered({ unload: u }: { unload: Unload }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const ix = useIndex()
  const left = Math.max(0, ix.loads.get(u.vehicleId) || 0)
  return (
    <View style={[s.success, { paddingBottom: insets.bottom + 16 }]}>
      <Stack.Screen options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <View style={s.check}><Icon name="checkmark" size={46} color="#fff" weight="bold" /></View>
        <Text style={s.successTitle}>Delivery completed</Text>
        <Text style={s.successSub}>{ix.facilities.get(u.facilityId || '')?.name}</Text>
        <Text style={s.successVolume}>{fmtL(u.volume)}</Text>
        <Text style={[s.successSub, left > 0 && { color: colors.warning, fontWeight: '700' }]}>
          {left > 0 ? `${fmtL(left)} still recorded on board ${ix.vehicles.get(u.vehicleId)?.plate || ''}` : 'Nothing left on board'}
        </Text>
      </View>
      <Button title="Back to Today" onPress={() => router.dismissTo('/')} />
    </View>
  )
}

const s = StyleSheet.create({
  group: { padding: 0, overflow: 'hidden' },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md, marginTop: 10 },
  bannerText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  volumeBox: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  volumeInput: { fontSize: 44, fontWeight: '800', color: colors.text, minWidth: 80, textAlign: 'center', padding: 0 },
  unit: { fontSize: 22, fontWeight: '700', color: colors.muted },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 10, fontWeight: '500' },
  wastes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waste: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  wasteText: { fontSize: 15, fontWeight: '700', color: colors.text },
  wasteCode: { fontSize: 12, fontWeight: '700', color: colors.muted },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  success: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  check: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  successSub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  successVolume: { fontSize: 44, fontWeight: '800', color: colors.primary, marginVertical: 4 },
})
