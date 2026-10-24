import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, IconButton, SectionCard, Segmented, StatTile, Tag } from '@/components/admin'
import { legsOf, workDays, type DayEvent, type WorkDay } from '@/lib/admin'
import { deviceTitle, fmtDay, fmtL, fmtM, fmtTime } from '@/lib/format'
import { distanceM } from '@/lib/geo'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

type Tab = 'today' | 'days'
const fmtMin = (m: number | null) => (m == null ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`)

export default function DriverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const [tab, setTab] = useState<Tab>('today')
  const [dayKey, setDayKey] = useState<string | null>(null)
  const driver = ix.drivers.get(id)

  const v = useMemo(() => {
    if (!data) return null
    const days = workDays(data, { driverId: id })
    const ongoing = data.pickups.find((p) => p.status === 'ongoing' && p.driverId === id)
    const vehicleId = ongoing?.vehicleId || [...data.pickups].filter((p) => p.driverId === id && p.vehicleId).sort((a, b) => (b.endAt || b.startAt || '').localeCompare(a.endAt || a.startAt || ''))[0]?.vehicleId
    const todayKey = new Date().toISOString().slice(0, 10)
    return { days, ongoing, vehicle: vehicleId ? ix.vehicles.get(vehicleId) : undefined, todayKey }
  }, [data, id, ix])

  if (!driver || !v) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Driver" back={() => router.back()} /><Text style={s.empty}>Not found.</Text></View>
  const company = driver.companyId ? ix.companies.get(driver.companyId) : undefined
  const shown: WorkDay | undefined = tab === 'today' ? v.days.find((d) => d.day === v.todayKey) : v.days.find((d) => d.day === dayKey) || v.days[0]
  const legs = shown ? legsOf(shown.events, (a, b) => distanceM(a.lat, a.lng, b.lat, b.lng)) : []
  const ini = driver.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()

  function title(e: DayEvent) {
    if (e.kind === 'pickup') return `${deviceTitle(ix.devices.get(e.ref.deviceId || ''), ix.locations.get(e.ref.locationId || ''))} · ${fmtL(e.volume)}`
    if (e.kind === 'unload') return `Unload · ${ix.facilities.get(e.facilityId || '')?.name || 'Facility'} · ${fmtL(e.volume)}`
    return `Transfer ${e.out ? 'to' : 'from'} ${ix.vehicles.get(e.otherVehicleId)?.plate || 'truck'} · ${fmtL(e.volume)}`
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="DRIVER" title={driver.name} back={() => router.back()}
        right={driver.phone ? <IconButton name="phone.fill" label="Call driver" onPress={() => Linking.openURL(`tel:${driver.phone}`)} /> : undefined}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <View style={s.avatar}><Text style={s.avatarText}>{ini}</Text></View>
          {v.ongoing ? <Tag label={`On job · ${deviceTitle(ix.devices.get(v.ongoing.deviceId || ''), ix.locations.get(v.ongoing.locationId || ''))}`} tone="blue" /> : <Tag label={driver.status || 'Active'} tone={driver.status === 'Active' || !driver.status ? 'green' : 'slate'} />}
          {company ? <Tag label={company.name} tone="slate" /> : null}
          {v.vehicle ? <Tag label={v.vehicle.plate} tone="slate" mono /> : null}
        </View>
        <Segmented options={[{ key: 'today', label: 'Today' }, { key: 'days', label: 'Working days', count: v.days.length }] as { key: Tab; label: string; count?: number }[]} value={tab} onChange={setTab} />
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        {shown ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <StatTile label="Jobs" value={String(shown.jobs)} />
            <StatTile label="Collected" value={fmtL(shown.litres).replace(' L', '')} />
            <StatTile label="On road" value={fmtMin(shown.minutes) || '0'} />
            <StatTile label="Flags" value={String(shown.flags)} color={shown.flags ? c.warningText : undefined} />
          </View>
        ) : null}

        {tab === 'days' ? (
          <ACard>
            {v.days.length ? v.days.slice(0, 30).map((d, i) => (
              <ARow key={d.day} title={fmtDay(d.day + 'T12:00:00')} subtitle={`${d.jobs} job${d.jobs === 1 ? '' : 's'} · ${fmtL(d.litres)} · ${fmtMin(d.minutes) || '—'}`}
                right={d.flags ? <Tag label={`${d.flags} flag${d.flags === 1 ? '' : 's'}`} tone="amber" /> : undefined}
                onPress={() => { setDayKey(d.day); setTab('today') }} last={i === Math.min(v.days.length, 30) - 1} />
            )) : <Text style={s.empty}>No activity recorded.</Text>}
          </ACard>
        ) : (
          <SectionCard title={shown ? (shown.day === v.todayKey ? "Today's legs" : `${fmtDay(shown.day + 'T12:00:00')} · legs`) : "Today's legs"}
            sub={shown ? `Started ${fmtTime(shown.firstAt)} · ${shown.events.length} stops` : 'No activity today'}>
            <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
              {legs.map((l, i) => {
                const e = l.event
                const flags = e.kind === 'pickup' ? e.flags : []
                const col = e.kind === 'unload' ? c.warning : e.kind === 'transfer' ? c.faint : c.success
                return (
                  <View key={e.id} style={s.leg}>
                    <View style={s.rail}><View style={[s.pt, { backgroundColor: col }]} />{i < legs.length - 1 ? <View style={s.line} /> : null}</View>
                    <View style={{ flex: 1, gap: 2, paddingBottom: 14 }}>
                      <Text style={s.legTitle} numberOfLines={2}>{title(e)}</Text>
                      <Text style={s.legSub} numberOfLines={2}>
                        {[l.fromAt ? `from ${fmtTime(l.fromAt)}` : null, fmtMin(l.minutes), l.metres != null ? fmtM(l.metres) : null].filter(Boolean).join(' · ') || 'First stop'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                        {l.slow ? <Tag label={`Slow leg · ${fmtMin(l.minutes)}`} tone="amber" /> : null}
                        {flags.includes('nolocation') ? <Tag label="No GPS" tone="amber" /> : null}
                        {flags.includes('location') ? <Tag label="Away from device" tone="amber" /> : null}
                        {flags.includes('capacity') ? <Tag label="Over capacity" tone="rose" /> : null}
                      </View>
                    </View>
                    <Text style={s.time}>{fmtTime(e.at)}</Text>
                  </View>
                )
              })}
              {v.ongoing && shown?.day === v.todayKey ? (
                <View style={s.leg}>
                  <View style={s.rail}><View style={[s.pt, { backgroundColor: c.primary }]} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={s.legTitle}>{deviceTitle(ix.devices.get(v.ongoing.deviceId || ''), ix.locations.get(v.ongoing.locationId || ''))} · in progress</Text>
                    <Text style={s.legSub}>Started {fmtTime(v.ongoing.startAt)}</Text>
                  </View>
                  <Text style={s.time}>{fmtTime(v.ongoing.startAt)}</Text>
                </View>
              ) : null}
              {!legs.length && !v.ongoing ? <Text style={s.empty}>Nothing recorded for this day.</Text> : null}
            </View>
          </SectionCard>
        )}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  leg: { flexDirection: 'row', gap: 10 },
  rail: { width: 14, alignItems: 'center' },
  pt: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#fff', marginTop: 3, shadowColor: '#94a3b8', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
  line: { flex: 1, width: 2, backgroundColor: c.border, marginTop: 2 },
  legTitle: { fontSize: 13, fontWeight: '600', color: c.text },
  legSub: { fontSize: 11.5, color: c.faint },
  time: { fontSize: 11.5, color: c.faint, width: 44, textAlign: 'right', fontFamily: 'Menlo' },
  empty: { fontSize: 13, color: c.faint, padding: 14, textAlign: 'center' },
})
