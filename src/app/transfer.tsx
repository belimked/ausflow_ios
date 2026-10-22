import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, EmptyState, Icon, Row, SectionTitle, toneColor } from '@/components/ui'
import { overCapacity } from '@/lib/delivery'
import { fmtL } from '@/lib/format'
import { currentCoords } from '@/lib/geo'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'
import type { Transfer, Vehicle } from '@/lib/types'

// Old WasteID "Transfer All Waste": the whole load of the driver's vehicle moves to another vehicle of the company.
export default function TransferScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ toVehicleId?: string }>()
  const { data, profile, transfer } = useStore()
  const ix = useIndex()
  const [toId, setToId] = useState(params.toVehicleId || '')
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<Transfer | null>(null)

  if (done) return <Transferred transfer={done} />
  const from = profile ? ix.vehicles.get(profile.vehicleId) : undefined
  if (!profile || !from) {
    return <EmptyState icon="truck.box" title="Choose your vehicle first" message="Waste is transferred from the vehicle you are driving."
      action={<Button title="Choose driver & vehicle" onPress={() => router.replace('/setup')} size="md" />} />
  }
  const load = Math.max(0, ix.loads.get(from.id) || 0)
  const to = toId ? ix.vehicles.get(toId) : undefined
  const toLoad = to ? Math.max(0, ix.loads.get(to.id) || 0) : 0
  const over = !!to && overCapacity(toLoad, load, to.tank)
  // Loads mostly move from a small truck into the big tanker, so large trucks (then bigger tanks) come first.
  const others = (data?.vehicles || []).filter((v) => v.companyId === profile.companyId && v.status === 'active' && v.id !== from.id)
    .sort((a, b) => Number(b.type === 'large') - Number(a.type === 'large') || (b.tank || 0) - (a.tank || 0))

  async function go() {
    if (!to) return
    if (over) {
      const ok = await new Promise<boolean>((resolve) => Alert.alert('Over capacity',
        `${to.plate} would hold ${fmtL(toLoad + load)}, more than its ${fmtL(to.tank)} tank. Transfer anyway?`,
        [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Transfer', style: 'destructive', onPress: () => resolve(true) }]))
      if (!ok) return
    }
    try {
      setBusy('Getting your location…')
      const coords = await currentCoords()
      setBusy('Saving…')
      const t = await transfer(to.id, coords)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      setDone(t)
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not transfer the waste', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const danger = toneColor('danger')
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Text style={s.intro}>
          Move the whole load from this truck into another truck of your company, for example from a small truck into the big tanker.
          Scan the sticker of the other truck or pick it from the list.
        </Text>

        <SectionTitle title="From" />
        <Card style={s.group}>
          <Row icon="truck.box.fill" title={from.plate} subtitle={`${fmtL(load)} on board · all of it will be transferred`} />
        </Card>

        <SectionTitle title="To" />
        <Card style={s.group}>
          {to ? (
            <Row testID="transfer-to" icon="truck.box" title={to.plate} subtitle={vehicleLine(to, toLoad)}
              right={<Pressable hitSlop={8} onPress={() => setToId('')}><Text style={s.link}>Change</Text></Pressable>} />
          ) : (
            <>
              <Row testID="transfer-scan" icon="qrcode.viewfinder" title="Scan the receiving vehicle"
                onPress={() => router.replace({ pathname: '/scan', params: { mode: 'transfer' } })} />
              {others.map((v) => (
                <View key={v.id}><Divider />
                  <Row icon="truck.box" tone="neutral" title={v.plate} subtitle={vehicleLine(v, Math.max(0, ix.loads.get(v.id) || 0))} onPress={() => setToId(v.id)} />
                </View>
              ))}
              {!others.length ? <><Divider /><EmptyState icon="truck.box" title="No other vehicles" message="Your company has no other active vehicle." /></> : null}
            </>
          )}
        </Card>

        {to ? (
          <Card style={[s.summary, over && { borderColor: danger.fg }]}>
            <Text style={s.summaryLabel}>AFTER THE TRANSFER</Text>
            <Text style={s.summaryLine}>{from.plate}: {fmtL(0)}</Text>
            <Text style={[s.summaryLine, over && { color: danger.fg }]}>
              {to.plate}: {fmtL(toLoad + load)}{to.tank ? ` of ${fmtL(to.tank)}` : ''}
            </Text>
            {over ? (
              <View style={s.warn}>
                <Icon name="exclamationmark.triangle.fill" size={14} color={danger.fg} />
                <Text style={[s.warnText, { color: danger.fg }]}>More than the receiving tank holds. The office will see this flagged.</Text>
              </View>
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="transfer-submit" icon="arrow.left.arrow.right" onPress={go} disabled={!to || load <= 0} loading={!!busy}
          title={busy || (load <= 0 ? 'Nothing on board' : !to ? 'Choose the receiving vehicle' : `Transfer all waste · ${fmtL(load)}`)} />
      </View>
    </View>
  )
}

const vehicleLine = (v: Vehicle, load: number) => `${v.type === 'large' ? 'Large truck' : 'Small truck'} · ${fmtL(load)} on board${v.tank ? ` · ${fmtL(v.tank)} tank` : ''}`

function Transferred({ transfer: t }: { transfer: Transfer }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const ix = useIndex()
  return (
    <View style={[s.success, { paddingBottom: insets.bottom + 16 }]}>
      <Stack.Screen options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <View style={s.check}><Icon name="checkmark" size={46} color="#fff" weight="bold" /></View>
        <Text style={s.successTitle}>Waste transferred</Text>
        <Text style={s.successVolume}>{fmtL(t.volume)}</Text>
        <Text style={s.successSub}>{ix.vehicles.get(t.fromVehicleId)?.plate} → {ix.vehicles.get(t.toVehicleId)?.plate}</Text>
      </View>
      <Button title="Back to Today" onPress={() => router.dismissTo('/')} />
    </View>
  )
}

const s = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21, paddingHorizontal: 4 },
  group: { padding: 0, overflow: 'hidden' },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  summary: { marginTop: 16, gap: 4, borderWidth: 2, borderColor: 'transparent' },
  summaryLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, marginBottom: 4 },
  summaryLine: { fontSize: 17, fontWeight: '700', color: colors.text },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  warnText: { flex: 1, fontSize: 13, fontWeight: '600' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  success: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 20 },
  check: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  successTitle: { fontSize: 26, fontWeight: '800', color: colors.text },
  successSub: { fontSize: 15, color: colors.muted, textAlign: 'center' },
  successVolume: { fontSize: 44, fontWeight: '800', color: colors.primary, marginVertical: 4 },
})
