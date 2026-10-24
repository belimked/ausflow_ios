import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, KV, LinkText, SectionCard, Segmented, StatTile, Tag } from '@/components/admin'
import { activeDriverIds, donePickupsSince, dueBuckets, litresOf, sortByDue } from '@/lib/admin'
import { deviceTitle, dueState, fmtL, fmtTime } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

type Tab = 'overview' | 'drivers' | 'vehicles' | 'devices'
const TONE = { overdue: 'rose', soon: 'amber', ok: 'green', unknown: 'slate' } as const

export default function CompanyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const [tab, setTab] = useState<Tab>('overview')
  const co = ix.companies.get(id)

  const v = useMemo(() => {
    if (!data) return null
    const devices = data.devices.filter((d) => d.companyId === id)
    const drivers = data.drivers.filter((d) => d.companyId === id).sort((a, b) => a.name.localeCompare(b.name))
    const vehicles = data.vehicles.filter((x) => x.companyId === id).sort((a, b) => a.plate.localeCompare(b.plate))
    const pickups = data.pickups.filter((p) => p.companyId === id)
    const p7 = donePickupsSince(pickups, 7)
    const b = dueBuckets(devices)
    const today = activeDriverIds(data, 1)
    const ongoing = new Map(data.pickups.filter((p) => p.status === 'ongoing' && p.driverId).map((p) => [p.driverId!, p]))
    const occupiers = new Set(devices.map((d) => d.ownerId).filter(Boolean) as string[])
    return { devices: sortByDue(devices), drivers, vehicles, p7, litres7: litresOf(p7), b, today, ongoing, occupiers: occupiers.size }
  }, [data, id])

  if (!co || !v) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Company" back={() => router.back()} /><Text style={s.empty}>Not found.</Text></View>
  const compliance = v.b.active ? Math.round((100 - (v.b.overdue / v.b.active) * 100) * 10) / 10 : 100

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="TRANSPORT COMPANY" title={co.name} back={() => router.back()}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Tag label={co.status || 'Active'} tone={co.status === 'Active' || !co.status ? 'green' : 'slate'} />
          {v.b.overdue ? <Tag label={`${v.b.overdue} overdue`} tone="rose" /> : <Tag label="Nothing overdue" tone="green" />}
          {co.phone ? <Tag label={co.phone} tone="slate" mono /> : null}
        </View>
        <Segmented options={[{ key: 'overview', label: 'Overview' }, { key: 'drivers', label: 'Drivers', count: v.drivers.length }, { key: 'vehicles', label: 'Vehicles', count: v.vehicles.length }, { key: 'devices', label: 'Devices', count: v.devices.length }] as { key: Tab; label: string; count?: number }[]} value={tab} onChange={setTab} />
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        {tab === 'overview' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatTile label="Devices" value={String(v.b.active)} onPress={() => setTab('devices')} />
              <StatTile label="Overdue" value={String(v.b.overdue)} color={v.b.overdue ? c.dangerText : undefined} onPress={() => router.navigate({ pathname: '/devices', params: { filter: 'overdue', company: id } })} />
              <StatTile label="Jobs · 7d" value={String(v.p7.length)} />
              <StatTile label="Litres · 7d" value={fmtL(v.litres7).replace(' L', '')} />
            </View>
            <SectionCard title="Compliance" sub="Service schedule across this company's devices" right={<Text style={s.pct}>{compliance}%</Text>}>
              <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
                <View style={s.bar}>
                  {[{ v: v.b.ok + v.b.none, col: c.success }, { v: v.b.soon, col: c.warning }, { v: v.b.overdue, col: c.danger }].filter((x) => x.v).map((x, i) => <View key={i} style={{ flex: x.v, backgroundColor: x.col }} />)}
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Text style={s.legend}>Not due {v.b.ok + v.b.none}</Text><Text style={s.legend}>Due soon {v.b.soon}</Text><Text style={s.legend}>Overdue {v.b.overdue}</Text>
                </View>
              </View>
            </SectionCard>
            <SectionCard title="Drivers active today" sub={v.today.size ? undefined : 'No activity recorded today'} right={<LinkText label={`All ${v.drivers.length}`} onPress={() => setTab('drivers')} />}>
              {v.drivers.filter((d) => v.today.has(d.id)).map((d, i, arr) => {
                const on = v.ongoing.get(d.id)
                return <ARow key={d.id} icon="person.fill" iconTone={on ? 'blue' : 'slate'} title={d.name} subtitle={on ? `On job · ${deviceTitle(ix.devices.get(on.deviceId || ''), ix.locations.get(on.locationId || ''))}` : 'Finished for now'} right={on ? <Tag label="Active" tone="blue" /> : undefined} last={i === arr.length - 1} onPress={() => router.push(`/driver/${d.id}`)} />
              })}
            </SectionCard>
            <ACard>
              <View style={{ flexDirection: 'row' }}>
                <KV label="Phone" value={co.phone || '—'} />
                <KV label="Occupiers served" value={String(v.occupiers)} right />
              </View>
              <View style={{ flexDirection: 'row' }}>
                <KV label="Vehicles" value={String(v.vehicles.length)} last />
                <KV label="Company ID" value={<Text style={s.mono}>{co.id}</Text>} right last />
              </View>
            </ACard>
          </>
        ) : null}
        {tab === 'drivers' ? (
          <ACard>
            {v.drivers.length ? v.drivers.map((d, i) => {
              const on = v.ongoing.get(d.id)
              return <ARow key={d.id} icon="person.fill" iconTone={on ? 'blue' : v.today.has(d.id) ? 'green' : 'slate'} title={d.name} subtitle={[d.account ? `@${d.account}` : null, d.phone, d.status !== 'Active' ? d.status : null].filter(Boolean).join(' · ') || 'Driver'}
                right={on ? <Tag label="On job" tone="blue" /> : v.today.has(d.id) ? <Tag label="Today" tone="green" /> : undefined} last={i === v.drivers.length - 1} onPress={() => router.push(`/driver/${d.id}`)} />
            }) : <Text style={s.empty}>No drivers.</Text>}
          </ACard>
        ) : null}
        {tab === 'vehicles' ? (
          <ACard>
            {v.vehicles.length ? v.vehicles.map((x, i) => {
              const load = ix.loads.get(x.id) || 0
              return <ARow key={x.id} icon="truck.box.fill" iconTone={load ? 'blue' : 'slate'} title={<Text style={s.plate}>{x.plate}</Text>} subtitle={[x.type, x.tank ? `${fmtL(x.tank)} tank` : null, x.status !== 'Active' ? x.status : null].filter(Boolean).join(' · ') || 'Vehicle'}
                right={<Text style={s.load}>{fmtL(load)} on board</Text>} last={i === v.vehicles.length - 1} onPress={() => router.push(`/vehicle/${x.id}`)} />
            }) : <Text style={s.empty}>No vehicles.</Text>}
          </ACard>
        ) : null}
        {tab === 'devices' ? (
          <ACard>
            {v.devices.length ? v.devices.slice(0, 100).map((d, i) => {
              const due = dueState(d)
              const loc = d.locationId ? ix.locations.get(d.locationId) : undefined
              return <ARow key={d.id} icon="drop.fill" iconTone={TONE[due.state]} title={deviceTitle(d, loc)} subtitle={<Text style={s.sub}><Text style={s.mono}>{d.ref}</Text>{d.capacity ? ` · ${fmtL(d.capacity)}` : ''}</Text>}
                right={<Tag label={due.label} tone={TONE[due.state]} />} last={i === Math.min(v.devices.length, 100) - 1} onPress={() => router.push(`/device/${d.id}`)} />
            }) : <Text style={s.empty}>No devices assigned.</Text>}
            {v.devices.length > 100 ? <Text style={s.empty}>Showing the first 100 · use the Devices tab to search.</Text> : null}
          </ACard>
        ) : null}
        <Text style={s.foot}>Last data refresh {fmtTime(new Date().toISOString())}</Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  pct: { fontSize: 13, fontWeight: '600', color: c.successText, fontFamily: 'Menlo' },
  bar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', gap: 2 },
  legend: { fontSize: 11, color: c.faint },
  mono: { fontFamily: 'Menlo', color: c.primary, fontSize: 12 },
  plate: { fontFamily: 'Menlo', fontSize: 14, fontWeight: '700', color: c.text },
  load: { fontSize: 11, color: c.faint, fontFamily: 'Menlo' },
  sub: { fontSize: 11.5, color: c.faint },
  empty: { fontSize: 13, color: c.faint, padding: 14, textAlign: 'center' },
  foot: { fontSize: 11, color: c.ghost, textAlign: 'center' },
})
