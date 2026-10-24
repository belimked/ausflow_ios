import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, Bars, KV, LinkText, SectionCard, Tag } from '@/components/admin'
import { workDays } from '@/lib/admin'
import { fmtDay, fmtL, fmtTime } from '@/lib/format'
import { currentCycle } from '@/lib/load'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const vehicle = ix.vehicles.get(id)

  const v = useMemo(() => {
    if (!data) return null
    const days = workDays(data, { vehicleId: id })
    const cycle = currentCycle(data, id)
    const load = ix.loads.get(id) || 0
    const ongoing = data.pickups.find((p) => p.status === 'ongoing' && p.vehicleId === id)
    const lastDriverId = ongoing?.driverId || [...data.pickups].filter((p) => p.vehicleId === id && p.driverId).sort((a, b) => (b.endAt || b.startAt || '').localeCompare(a.endAt || a.startAt || ''))[0]?.driverId
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i))
      const key = d.toISOString().slice(0, 10)
      return { key, label: d.toLocaleDateString('en-AU', { weekday: 'short' }), litres: days.find((x) => x.day === key)?.litres || 0 }
    })
    return { days, cycle, load, ongoing, driver: lastDriverId ? ix.drivers.get(lastDriverId) : undefined, week }
  }, [data, id, ix])

  if (!vehicle || !v) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Vehicle" back={() => router.back()} /><Text style={s.empty}>Not found.</Text></View>
  const company = vehicle.companyId ? ix.companies.get(vehicle.companyId) : undefined
  const pct = vehicle.tank ? Math.min(100, Math.round((v.load / vehicle.tank) * 100)) : null
  const over = !!vehicle.tank && v.load > vehicle.tank

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="VEHICLE" title={vehicle.plate} back={() => router.back()} right={<Tag label={vehicle.status || 'Active'} tone={vehicle.status === 'Active' || !vehicle.status ? 'green' : 'slate'} />}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {vehicle.type ? <Tag label={vehicle.type} tone="slate" /> : null}
          {company ? <Tag label={company.name} tone="slate" /> : null}
          {v.ongoing ? <Tag label="On a job now" tone="blue" /> : null}
        </View>
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        <SectionCard title="On board now" right={v.driver ? <LinkText label={`${v.driver.name}${v.ongoing ? ' · on job' : ''}`} onPress={() => router.push(`/driver/${v.driver!.id}`)} /> : undefined}>
          <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text style={[s.big, over && { color: c.dangerText }]}>{fmtL(v.load)}</Text>
              <Text style={s.muted}>{vehicle.tank ? `of ${fmtL(vehicle.tank)}` : 'tank size not set'}{v.cycle ? ` · since ${fmtTime(v.cycle.startAt)} ${fmtDay(v.cycle.startAt)}` : v.load ? '' : ' · empty'}</Text>
            </View>
            <View style={s.track}><View style={[s.fill, { width: `${pct ?? (v.load ? 100 : 0)}%`, backgroundColor: over ? c.danger : pct != null && pct > 85 ? c.warning : c.primary }]} /></View>
            <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
              <Text style={s.legend}>{v.cycle ? `${v.cycle.pickups.length} pickup${v.cycle.pickups.length === 1 ? '' : 's'} in this load` : 'No open load'}</Text>
              {over ? <Tag label="Over tank capacity" tone="rose" /> : null}
            </View>
          </View>
        </SectionCard>

        <ACard>
          <View style={{ flexDirection: 'row' }}>
            <KV label="Tank capacity" value={vehicle.tank ? fmtL(vehicle.tank) : '—'} />
            <KV label="Type" value={vehicle.type || '—'} right />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <KV label="QR code" value={<LinkText label={`${vehicle.qr || vehicle.id} · sticker ›`} onPress={() => router.push({ pathname: '/qr', params: { kind: 'vehicle', id: vehicle.id } })} />} last />
            <KV label="Vehicle ID" value={<Text style={s.mono}>{vehicle.id}</Text>} right last />
          </View>
        </ACard>

        <SectionCard title="Loads · last 7 days" sub={`${fmtL(v.week.reduce((n, d) => n + d.litres, 0))} collected`} right={<LinkText label="Records" onPress={() => router.navigate('/records')} />}>
          <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            <Bars rows={v.week.map((d) => d.litres)} labels={v.week.map((d) => d.label)} height={64} tooltip={(i) => `${v.week[i].label} · ${fmtL(v.week[i].litres)}`} />
          </View>
          {v.days.slice(0, 7).map((d, i, arr) => (
            <ARow key={d.day} title={fmtDay(d.day + 'T12:00:00')} subtitle={`${d.jobs} pickup${d.jobs === 1 ? '' : 's'} · ${d.events.filter((e) => e.kind === 'unload').length} unload${d.events.filter((e) => e.kind === 'unload').length === 1 ? '' : 's'}`}
              right={<Text style={s.vol}>{fmtL(d.litres)}</Text>} last={i === arr.length - 1} />
          ))}
          {!v.days.length ? <Text style={s.empty}>No activity recorded.</Text> : null}
        </SectionCard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  big: { fontSize: 28, fontWeight: '600', color: c.text, fontFamily: 'Menlo' },
  muted: { fontSize: 12.5, color: c.faint, flexShrink: 1 },
  track: { height: 10, borderRadius: 5, backgroundColor: c.hairline, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  legend: { fontSize: 11, color: c.faint },
  mono: { fontFamily: 'Menlo', fontSize: 12.5, color: c.text, fontWeight: '600' },
  vol: { fontSize: 13, fontWeight: '600', color: c.text, fontFamily: 'Menlo' },
  empty: { fontSize: 13, color: c.faint, padding: 14, textAlign: 'center' },
})
