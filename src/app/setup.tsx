import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, EmptyState, Icon, Row } from '@/components/ui'
import { fmtL } from '@/lib/format'
import { findVehiclesByPlate, isTransport, joinVehicle } from '@/lib/profile'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'
import type { Vehicle } from '@/lib/types'

function Check({ on }: { on: boolean }) {
  return on ? <Icon name="checkmark.circle.fill" size={22} color={colors.primary} /> : <Icon name="circle" size={22} color={colors.border} />
}

const vehicleSub = (v: Vehicle) => `${v.type === 'large' ? 'Large truck' : 'Small truck'}${v.tank ? ` · ${v.tank.toLocaleString('en-AU')} L tank` : ''}`

export default function Setup() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  // Set when the driver arrives here by scanning a vehicle sticker.
  const { vehicleId: scannedId } = useLocalSearchParams<{ vehicleId?: string }>()
  const { data, profile, setProfile } = useStore()
  const ix = useIndex()
  const scanned = scannedId ? ix.vehicles.get(scannedId) : undefined
  const initial = scanned && data ? joinVehicle(data, profile, scanned) : profile
  const [companyId, setCompanyId] = useState(initial?.companyId || '')
  const [driverId, setDriverId] = useState(initial?.driverId || '')
  const [vehicleId, setVehicleId] = useState(initial?.vehicleId || '')
  const [plate, setPlate] = useState('')

  const companies = useMemo(() => (data?.companies || []).filter((c) => c.status === 'active' && isTransport(c)), [data])
  const driversOf = (cid: string) => (data?.drivers || []).filter((d) => d.companyId === cid && d.status === 'active')
  const vehiclesOf = (cid: string) => (data?.vehicles || []).filter((v) => v.companyId === cid && v.status === 'active')
  const drivers = driversOf(companyId)
  const vehicles = vehiclesOf(companyId)
  const matches = data ? findVehiclesByPlate(data, plate) : []

  function pickCompany(id: string) {
    if (id === companyId) return
    const ds = driversOf(id), vs = vehiclesOf(id)
    setCompanyId(id)
    setDriverId(ds.length === 1 ? ds[0].id : '')
    setVehicleId(vs.length === 1 ? vs[0].id : '')
  }

  function pickVehicle(v: Vehicle) {
    if (!data) return
    const p = joinVehicle(data, { companyId, driverId, vehicleId }, v)
    setCompanyId(p.companyId)
    setDriverId(p.driverId)
    setVehicleId(p.vehicleId)
    setPlate('')
  }

  const ready = drivers.some((d) => d.id === driverId) && vehicles.some((v) => v.id === vehicleId)

  async function save() {
    // Leaving a vehicle with waste on board: the old app offered a transfer; until that lands, warn and confirm.
    const left = profile && profile.vehicleId !== vehicleId ? ix.loads.get(profile.vehicleId) || 0 : 0
    if (left > 0) {
      const old = ix.vehicles.get(profile!.vehicleId)
      const ok = await new Promise<boolean>((resolve) => Alert.alert(
        'Waste still on board',
        `${fmtL(left)} is recorded on ${old?.plate || 'your current vehicle'}. It stays on that vehicle until it is offloaded or transferred.`,
        [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Change vehicle', onPress: () => resolve(true) }],
      ))
      if (!ok) return
    }
    await setProfile({ companyId, driverId, vehicleId })
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <Text style={s.intro}>Pickups you record are saved under this driver and vehicle.</Text>

        <Text style={s.step}>Find your vehicle</Text>
        <Card style={s.group}>
          <Row testID="setup-scan-vehicle" icon="qrcode.viewfinder" title="Scan vehicle sticker" subtitle="Join the vehicle by its QR sticker"
            onPress={() => router.replace({ pathname: '/scan', params: { mode: 'vehicle' } })} />
          <Divider />
          <View style={s.search}>
            <Icon name="magnifyingglass" size={16} color={colors.faint} />
            <TextInput testID="setup-plate" value={plate} onChangeText={setPlate} placeholder="Registration, e.g. 123 ABC" placeholderTextColor={colors.faint}
              autoCapitalize="characters" autoCorrect={false} clearButtonMode="while-editing" style={s.input} />
          </View>
          {plate.trim() ? (matches.length ? matches.slice(0, 8).map((v) => (
            <View key={v.id}><Divider />
              <Row testID="setup-plate-match" icon="truck.box.fill" title={v.plate} subtitle={`${ix.companies.get(v.companyId || '')?.name || ''} · ${vehicleSub(v)}`} onPress={() => pickVehicle(v)} />
            </View>
          )) : <><Divider /><EmptyState icon="truck.box" title="No vehicle with that registration" /></>) : null}
        </Card>

        <Text style={s.step}>1 · Transport company</Text>
        <Card style={s.group}>
          {companies.map((c, i) => (
            <View key={c.id}>{i > 0 && <Divider />}
              <Row icon="building.2.fill" title={c.name} onPress={() => pickCompany(c.id)} chevron={false} right={<Check on={companyId === c.id} />} />
            </View>
          ))}
        </Card>

        {companyId ? (
          <>
            <Text style={s.step}>2 · Driver</Text>
            <Card style={s.group}>
              {drivers.length ? drivers.map((d, i) => (
                <View key={d.id}>{i > 0 && <Divider />}
                  <Row icon="person.fill" title={d.name} subtitle={d.phone || undefined} onPress={() => setDriverId(d.id)} chevron={false} right={<Check on={driverId === d.id} />} />
                </View>
              )) : <EmptyState icon="person.slash" title="No active drivers" message="Add or approve drivers for this company in the web console." />}
            </Card>

            <Text style={s.step}>3 · Vehicle</Text>
            <Card style={s.group}>
              {vehicles.length ? vehicles.map((v, i) => (
                <View key={v.id}>{i > 0 && <Divider />}
                  <Row icon="truck.box.fill" title={v.plate} subtitle={vehicleSub(v)}
                    onPress={() => setVehicleId(v.id)} chevron={false} right={<Check on={vehicleId === v.id} />} />
                </View>
              )) : <EmptyState icon="truck.box" title="No active vehicles" message="Add vehicles for this company in the web console." />}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button testID="setup-save" title="Save" icon="checkmark" onPress={save} disabled={!ready} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21, paddingHorizontal: 4 },
  step: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, paddingHorizontal: 4 },
  group: { padding: 0, overflow: 'hidden' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginVertical: 10, height: 42, borderRadius: radius.sm, backgroundColor: colors.bg, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
