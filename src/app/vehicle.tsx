import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { JobRow } from '@/components/items'
import { Button, Card, Divider, EmptyState, Row, SectionTitle } from '@/components/ui'
import { fmtDateTime, fmtL } from '@/lib/format'
import { currentCycle } from '@/lib/load'
import { useIndex, useStore } from '@/lib/store'
import { colors } from '@/lib/theme'

// Old WasteID "Show": what is on board the driver's vehicle since it was last emptied.
export default function VehicleLoad() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, profile, canWrite } = useStore()
  const ix = useIndex()
  const vehicle = profile ? ix.vehicles.get(profile.vehicleId) : undefined
  const cycle = useMemo(() => (data && vehicle ? currentCycle(data, vehicle.id) : null), [data, vehicle])

  if (!vehicle) {
    return <EmptyState icon="truck.box" title="No vehicle selected" action={<Button title="Choose driver & vehicle" onPress={() => router.replace('/setup')} size="md" />} />
  }
  const load = Math.max(0, ix.loads.get(vehicle.id) || 0)
  const pickups = [...(cycle?.pickups || [])].reverse()
  const transfersIn = [...(cycle?.transfersIn || [])].reverse()

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 170 }}>
        <Card>
          <Text style={s.label}>ON BOARD · {vehicle.plate}</Text>
          <Text style={s.value}>{fmtL(load)}{vehicle.tank ? <Text style={s.tank}> / {fmtL(vehicle.tank)}</Text> : null}</Text>
          {cycle ? <Text style={s.since}>Loading since {fmtDateTime(cycle.startAt)}</Text> : null}
        </Card>

        <SectionTitle title={`Pickups on board · ${pickups.length}`} />
        <Card style={s.group}>
          {pickups.length ? pickups.map((p, i) => (
            <View key={p.id}>{i > 0 && <Divider />}<JobRow pickup={p} /></View>
          )) : <EmptyState icon="tray" title="No pickups on board" />}
        </Card>

        {transfersIn.length ? (
          <>
            <SectionTitle title="Transferred in" />
            <Card style={s.group}>
              {transfersIn.map((t, i) => (
                <View key={t.id}>{i > 0 && <Divider />}
                  <Row icon="arrow.left.arrow.right" tone="neutral" title={`${fmtL(t.volume)} from ${ix.vehicles.get(t.fromVehicleId)?.plate || 'another vehicle'}`}
                    subtitle={fmtDateTime(t.at)} />
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
      {canWrite && load > 0 ? (
        <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
          <Button testID="vehicle-offload" title="Offload at a facility" kind="success" icon="arrow.down.to.line" onPress={() => router.push('/offload')} />
          <Button testID="vehicle-transfer" title="Transfer to another vehicle" kind="ghost" size="md" icon="arrow.left.arrow.right" onPress={() => router.push('/transfer')} style={{ marginTop: 4 }} />
        </View>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6 },
  value: { fontSize: 32, fontWeight: '800', color: colors.text, marginTop: 6 },
  tank: { fontSize: 16, fontWeight: '600', color: colors.faint },
  since: { fontSize: 13, color: colors.muted, marginTop: 4 },
  group: { padding: 0, overflow: 'hidden' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
