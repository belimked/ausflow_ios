import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FlagPills } from '@/components/items'
import { Button, Card, Divider, EmptyState, Icon, IconBadge, Pill, Row, SectionTitle } from '@/components/ui'
import { LOCATION_FLAG_METRES } from '@/lib/config'
import { deviceTitle, fmtDateTime, fmtDuration, fmtL, fmtM, fmtTime } from '@/lib/format'
import { currentCoords } from '@/lib/geo'
import { pickupDelivery } from '@/lib/load'
import { useIndex, useStore } from '@/lib/store'
import { colors } from '@/lib/theme'
import type { Pickup } from '@/lib/types'
import { DEFAULT_WASTE, wasteCodeOf, wasteOptions } from '@/lib/waste'
import { useNow } from '@/lib/useNow'

export default function JobScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const ix = useIndex()
  const { profile, canWrite } = useStore()
  const [finished, setFinished] = useState<Pickup | null>(null)
  useNow(15000)

  const p = finished || ix.pickups.get(id)
  if (!p) return <EmptyState icon="questionmark.circle" title="Pickup not found" message="It may have been cancelled." />
  if (finished) return <Success pickup={finished} />
  const editable = canWrite && p.status === 'ongoing' && !!profile && p.driverId === profile.driverId
  return editable ? <FinishForm pickup={p} onDone={setFinished} /> : <Details pickup={p} />
}

function useJobContext(p: Pickup) {
  const ix = useIndex()
  const dev = p.deviceId ? ix.devices.get(p.deviceId) : undefined
  const loc = p.locationId ? ix.locations.get(p.locationId) : undefined
  return {
    dev, loc,
    driver: p.driverId ? ix.drivers.get(p.driverId) : undefined,
    vehicle: p.vehicleId ? ix.vehicles.get(p.vehicleId) : undefined,
    title: deviceTitle(dev, loc),
  }
}

function FinishForm({ pickup, onDone }: { pickup: Pickup; onDone: (p: Pickup) => void }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { finishJob, cancelJob } = useStore()
  const { dev, title, vehicle } = useJobContext(pickup)
  const [volume, setVolume] = useState('')
  const [note, setNote] = useState('')
  const [waste, setWaste] = useState(pickup.waste || DEFAULT_WASTE)
  const wastes = wasteOptions(pickup.waste || dev?.waste)
  const [busy, setBusy] = useState<string | null>(null)

  const cap = dev?.capacity || 0
  const v = Number(volume.replace(/[^\d.]/g, ''))
  const valid = volume.trim() !== '' && v > 0
  const over = cap > 0 && v > cap
  const presets = cap ? [0.25, 0.5, 0.75, 1].map((f) => ({ label: `${f * 100}%`, value: Math.round((cap * f) / 10) * 10 })) : []

  function bump(delta: number) {
    Haptics.selectionAsync()
    setVolume(String(Math.max(0, (v || 0) + delta)))
  }

  async function complete() {
    try {
      setBusy('Getting your location…')
      const coords = await currentCoords()
      setBusy('Saving…')
      const done = await finishJob(pickup.id, { volume: v, note, coords, waste })
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      onDone(done)
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not complete pickup', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function cancel() {
    Alert.alert('Cancel this pickup?', 'The pickup will be deleted. Use this only if it was started by mistake.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel pickup', style: 'destructive', onPress: async () => {
          try { await cancelJob(pickup.id); router.back() } catch (e) { Alert.alert('Could not cancel', (e as Error).message) }
        },
      },
    ])
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Finish pickup' }} />
      <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Card style={s.live}>
          <View style={s.liveHead}>
            <View style={s.dot} />
            <Text style={s.liveLabel}>IN PROGRESS · {fmtDuration(pickup.startAt!)}</Text>
          </View>
          <Pressable onPress={() => dev && router.push(`/device/${dev.id}`)}>
            <Text style={s.liveTitle}>{title}</Text>
          </Pressable>
          <Text style={s.liveSub}>Started {fmtTime(pickup.startAt)} · {dev?.ref}{vehicle ? ` · ${vehicle.plate}` : ''}</Text>
        </Card>

        <SectionTitle title="Volume collected" />
        <Card>
          <View style={s.volumeRow}>
            <Pressable onPress={() => bump(-50)} style={s.step}><Icon name="minus" size={20} color={colors.primary} /></Pressable>
            <View style={s.volumeBox}>
              <TextInput
                value={volume} onChangeText={(t) => setVolume(t.replace(/[^\d]/g, ''))} keyboardType="number-pad" placeholder="0"
                placeholderTextColor={colors.faint} style={s.volumeInput} maxLength={6} />
              <Text style={s.unit}>L</Text>
            </View>
            <Pressable onPress={() => bump(50)} style={s.step}><Icon name="plus" size={20} color={colors.primary} /></Pressable>
          </View>
          {presets.length ? (
            <View style={s.presets}>
              {presets.map((x) => (
                <Pressable key={x.label} onPress={() => { Haptics.selectionAsync(); setVolume(String(x.value)) }}
                  style={[s.preset, v === x.value && { backgroundColor: colors.primary }]}>
                  <Text style={[s.presetText, v === x.value && { color: '#fff' }]}>{x.label}</Text>
                  <Text style={[s.presetSub, v === x.value && { color: 'rgba(255,255,255,0.8)' }]}>{x.value.toLocaleString('en-AU')}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <Text style={[s.hint, over && { color: colors.danger }]}>
            {over ? `More than the ${fmtL(cap)} trap capacity — it will be flagged for review.` : cap ? `Trap capacity ${fmtL(cap)}` : 'Trap capacity unknown'}
          </Text>
        </Card>

        <SectionTitle title="Waste type" />
        <View style={s.wastes}>
          {wastes.map((w) => {
            const on = w.toLowerCase() === waste.toLowerCase()
            const code = wasteCodeOf(w)
            return (
              <Pressable key={w} onPress={() => { Haptics.selectionAsync(); setWaste(w) }} style={[s.waste, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[s.wasteText, on && { color: '#fff' }]}>{w}</Text>
                {code ? <Text style={[s.wasteCode, on && { color: 'rgba(255,255,255,0.8)' }]}>{code}</Text> : null}
              </Pressable>
            )
          })}
        </View>

        <SectionTitle title="Note (optional)" />
        <Card style={{ padding: 0 }}>
          <TextInput value={note} onChangeText={setNote} placeholder="Anything the office should know, e.g. access issues" placeholderTextColor={colors.faint}
            multiline style={s.note} maxLength={500} />
        </Card>

        <Text style={s.gpsHint}>
          <Icon name="location.fill" size={11} color={colors.faint} /> Your location is recorded when you finish. Pickups more than {LOCATION_FLAG_METRES} m from the device are flagged.
        </Text>

        <Button testID="job-cancel" title="Cancel pickup" kind="ghost" onPress={cancel} style={{ marginTop: 18 }} size="md" />
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button title={busy || (valid ? `Complete · ${v.toLocaleString('en-AU')} L` : 'Enter volume to complete')} kind="success"
          icon="checkmark.circle.fill" onPress={complete} disabled={!valid} loading={!!busy} />
      </View>
    </View>
  )
}

function Success({ pickup }: { pickup: Pickup }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { title } = useJobContext(pickup)
  return (
    <View style={[s.success, { paddingBottom: insets.bottom + 16 }]}>
      <Stack.Screen options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <View style={s.check}><Icon name="checkmark" size={46} color="#fff" weight="bold" /></View>
        <Text style={s.successTitle}>Pickup completed</Text>
        <Text style={s.successSub}>{title}</Text>
        <Text style={s.successVolume}>{fmtL(pickup.volume)}</Text>
        <Text style={s.successSub}>{fmtDuration(pickup.startAt!, new Date(pickup.endAt!).getTime())} on site{pickup.distance != null ? ` · ${fmtM(pickup.distance)} from device` : ''}</Text>
        <View style={{ marginTop: 8 }}><FlagPills pickup={pickup} /></View>
      </View>
      <Button title="Scan next device" icon="qrcode.viewfinder" onPress={() => { router.dismissTo('/'); router.push('/scan') }} />
      <Button title="Back to Today" kind="ghost" onPress={() => router.dismissTo('/')} style={{ marginTop: 6 }} />
    </View>
  )
}

function Details({ pickup }: { pickup: Pickup }) {
  const router = useRouter()
  const { dev, driver, vehicle, title } = useJobContext(pickup)
  const { data } = useStore()
  const ix = useIndex()
  const ongoing = pickup.status === 'ongoing'
  const delivery = data && !ongoing && (pickup.volume || 0) > 0 ? pickupDelivery(data, pickup) : null
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ title: pickup.id }} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <IconBadge name={ongoing ? 'truck.box.fill' : 'checkmark'} tone={ongoing ? 'primary' : 'success'} size={52} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.liveTitle}>{title}</Text>
            <Pill label={ongoing ? 'In progress' : 'Completed'} tone={ongoing ? 'primary' : 'success'} />
          </View>
          {!ongoing ? <Text style={s.bigVolume}>{fmtL(pickup.volume)}</Text> : null}
        </View>
        {pickup.flags?.length ? <View style={{ marginTop: 12 }}><FlagPills pickup={pickup} /></View> : null}
      </Card>

      <SectionTitle title="Details" />
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Row icon="clock.fill" tone="neutral" title={fmtDateTime(pickup.startAt)} subtitle={ongoing ? `Started · ${fmtDuration(pickup.startAt!)} ago` : `to ${fmtTime(pickup.endAt)} · ${fmtDuration(pickup.startAt!, new Date(pickup.endAt!).getTime())}`} />
        <Divider />
        <Row icon="person.fill" tone="neutral" title={driver?.name || '—'} subtitle="Driver" />
        <Divider />
        <Row icon="truck.box.fill" tone="neutral" title={vehicle?.plate || '—'} subtitle="Vehicle" />
        <Divider />
        <Row icon="location.fill" tone="neutral" title={fmtM(pickup.distance)} subtitle="Distance from device" />
        {delivery ? (<><Divider /><Row icon={delivery.state === 'delivered' ? 'building.columns.fill' : 'truck.box.fill'} tone={delivery.state === 'delivered' ? 'success' : 'warning'}
          title={delivery.state === 'delivered' ? `Delivered to ${ix.facilities.get(delivery.facilityId || '')?.name || 'a facility'}` : `On board ${ix.vehicles.get(delivery.vehicleId || '')?.plate || 'a vehicle'}`}
          subtitle={delivery.unload ? fmtDateTime(delivery.unload.at) : 'Not offloaded yet'} /></>) : null}
        {pickup.waste ? (<><Divider /><Row icon="drop.fill" tone="neutral" title={[pickup.waste, wasteCodeOf(pickup.waste)].filter(Boolean).join(' · ')} subtitle="Waste type" /></>) : null}
        {pickup.note ? (<><Divider /><Row icon="note.text" tone="neutral" title="Note" subtitle={pickup.note} /></>) : null}
        {dev ? (<><Divider /><Row icon="drop.circle.fill" title={`Device ${dev.ref}`} subtitle="View device" onPress={() => router.push(`/device/${dev.id}`)} /></>) : null}
      </Card>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  live: { borderWidth: 2, borderColor: colors.primaryBright },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  liveLabel: { fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
  liveTitle: { fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 6 },
  liveSub: { fontSize: 14, color: colors.muted, marginTop: 3 },
  volumeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  volumeBox: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 6 },
  volumeInput: { fontSize: 44, fontWeight: '800', color: colors.text, minWidth: 80, textAlign: 'center', padding: 0 },
  unit: { fontSize: 22, fontWeight: '700', color: colors.muted },
  presets: { flexDirection: 'row', gap: 8, marginTop: 16 },
  preset: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: colors.bg },
  presetText: { fontSize: 15, fontWeight: '800', color: colors.text },
  presetSub: { fontSize: 11, fontWeight: '600', color: colors.muted, marginTop: 1 },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 12, fontWeight: '500' },
  wastes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waste: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  wasteText: { fontSize: 15, fontWeight: '700', color: colors.text },
  wasteCode: { fontSize: 12, fontWeight: '700', color: colors.muted },
  note: { minHeight: 96, padding: 14, fontSize: 16, color: colors.text, textAlignVertical: 'top' },
  gpsHint: { fontSize: 12, color: colors.faint, marginTop: 14, paddingHorizontal: 4, lineHeight: 17 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  success: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  check: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  successSub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  successVolume: { fontSize: 44, fontWeight: '800', color: colors.primary, marginVertical: 4 },
  bigVolume: { fontSize: 20, fontWeight: '800', color: colors.text },
})
