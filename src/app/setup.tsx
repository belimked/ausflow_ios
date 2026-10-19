import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Card, Divider, EmptyState, Icon, Row } from '@/components/ui'
import { useStore } from '@/lib/store'
import { colors } from '@/lib/theme'

const isTransport = (types: string) => { try { return JSON.parse(types || '["transport"]').includes('transport') } catch { return true } }

function Check({ on }: { on: boolean }) {
  return on ? <Icon name="checkmark.circle.fill" size={22} color={colors.primary} /> : <Icon name="circle" size={22} color={colors.border} />
}

export default function Setup() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, profile, setProfile } = useStore()
  const [companyId, setCompanyId] = useState(profile?.companyId || '')
  const [driverId, setDriverId] = useState(profile?.driverId || '')
  const [vehicleId, setVehicleId] = useState(profile?.vehicleId || '')

  const companies = useMemo(() => (data?.companies || []).filter((c) => c.status === 'active' && isTransport(c.types)), [data])
  const driversOf = (cid: string) => (data?.drivers || []).filter((d) => d.companyId === cid && d.status === 'active')
  const vehiclesOf = (cid: string) => (data?.vehicles || []).filter((v) => v.companyId === cid && v.status === 'active')
  const drivers = driversOf(companyId)
  const vehicles = vehiclesOf(companyId)

  function pickCompany(id: string) {
    if (id === companyId) return
    const ds = driversOf(id), vs = vehiclesOf(id)
    setCompanyId(id)
    setDriverId(ds.length === 1 ? ds[0].id : '')
    setVehicleId(vs.length === 1 ? vs[0].id : '')
  }

  const ready = drivers.some((d) => d.id === driverId) && vehicles.some((v) => v.id === vehicleId)

  async function save() {
    await setProfile({ companyId, driverId, vehicleId })
    router.back()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <Text style={s.intro}>Pickups you record are saved under this driver and vehicle.</Text>

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
                  <Row icon="truck.box.fill" title={v.plate}
                    subtitle={`${v.type === 'large' ? 'Large truck' : 'Small truck'}${v.tank ? ` · ${v.tank.toLocaleString('en-AU')} L tank` : ''}`}
                    onPress={() => setVehicleId(v.id)} chevron={false} right={<Check on={vehicleId === v.id} />} />
                </View>
              )) : <EmptyState icon="truck.box" title="No active vehicles" message="Add vehicles for this company in the web console." />}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Button title="Save" icon="checkmark" onPress={save} disabled={!ready} />
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  intro: { fontSize: 15, color: colors.muted, lineHeight: 21, paddingHorizontal: 4 },
  step: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8, paddingHorizontal: 4 },
  group: { padding: 0, overflow: 'hidden' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
