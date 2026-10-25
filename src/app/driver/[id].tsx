import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native'
import { AHeader, ARow, IconButton, SectionCard, StatTile, Tag } from '@/components/admin'
import { legsOf, workDays, type DayEvent } from '@/lib/admin'
import { deviceTitle, fmtDay, fmtL, fmtM, fmtTime } from '@/lib/format'
import { distanceM } from '@/lib/geo'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

const fmtMin = (m: number | null) => (m == null ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`)
const shortDay = (key: string) => new Date(key + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

// One screen, one selected day. The day strip under the header picks the day (Today first, then every working
// day, newest first); the legs and the stats follow it, and so does the route map. The list at the bottom is the
// same days with totals; tapping a row selects it and scrolls back up.
export default function DriverScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const scroll = useRef<ScrollViewInstance>(null)
  const todayKey = new Date().toISOString().slice(0, 10)
  const [day, setDay] = useState(todayKey)
  const driver = ix.drivers.get(id)

  const v = useMemo(() => {
    if (!data) return null
    const days = workDays(data, { driverId: id })
    const ongoing = data.pickups.find((p) => p.status === 'ongoing' && p.driverId === id)
    const vehicleId = ongoing?.vehicleId || [...data.pickups].filter((p) => p.driverId === id && p.vehicleId).sort((a, b) => (b.endAt || b.startAt || '').localeCompare(a.endAt || a.startAt || ''))[0]?.vehicleId
    return { days, ongoing, vehicle: vehicleId ? ix.vehicles.get(vehicleId) : undefined }
  }, [data, id, ix])

  if (!driver || !v) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Driver" back={() => router.back()} /><Text style={s.empty}>Not found.</Text></View>
  const company = driver.companyId ? ix.companies.get(driver.companyId) : undefined
  const shown = v.days.find((d) => d.day === day)
  const legs = shown ? legsOf(shown.events, distanceM) : []
  const isToday = day === todayKey
  const ini = driver.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()
  const strip = [todayKey, ...v.days.map((d) => d.day).filter((d) => d !== todayKey)].slice(0, 15)
  const pick = (k: string) => { setDay(k); scroll.current?.scrollTo({ y: 0, animated: true }) }

  function title(e: DayEvent) {
    if (e.kind === 'pickup') return `${deviceTitle(ix.devices.get(e.ref.deviceId || ''), ix.locations.get(e.ref.locationId || ''))} · ${fmtL(e.volume)}`
    if (e.kind === 'unload') return `Unload · ${ix.facilities.get(e.facilityId || '')?.name || 'Facility'} · ${fmtL(e.volume)}`
    return `Transfer ${e.out ? 'to' : 'from'} ${ix.vehicles.get(e.otherVehicleId)?.plate || 'truck'} · ${fmtL(e.volume)}`
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="DRIVER" title={driver.name} back={() => router.back()}
        right={<View style={{ flexDirection: 'row', gap: 8 }}>
          <IconButton name="map.fill" label={`Route map for ${isToday ? 'today' : shortDay(day)}`} onPress={() => router.push({ pathname: '/routemap', params: { driverId: id, day } })} />
          {driver.phone ? <IconButton name="phone.fill" label="Call driver" onPress={() => Linking.openURL(`tel:${driver.phone}`)} /> : null}
        </View>}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <View style={s.avatar}><Text style={s.avatarText}>{ini}</Text></View>
          {v.ongoing ? <Tag label={`On job · ${deviceTitle(ix.devices.get(v.ongoing.deviceId || ''), ix.locations.get(v.ongoing.locationId || ''))}`} tone="blue" /> : <Tag label={driver.status || 'Active'} tone={driver.status === 'Active' || !driver.status ? 'green' : 'slate'} />}
          {company ? <Tag label={company.name} tone="slate" /> : null}
          {v.vehicle ? <Tag label={v.vehicle.plate} tone="slate" mono /> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
          {strip.map((k) => {
            const d = v.days.find((x) => x.day === k)
            const on = k === day
            return (
              <Pressable key={k} onPress={() => setDay(k)} style={[s.chip, on && s.chipOn]} accessibilityState={{ selected: on }}>
                <Text style={[s.chipText, on && s.chipTextOn]}>{k === todayKey ? 'Today' : shortDay(k)}</Text>
                <Text style={[s.chipSub, on && { color: 'rgba(255,255,255,.8)' }]}>{d ? `${d.jobs} job${d.jobs === 1 ? '' : 's'}` : 'no jobs'}</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </AHeader>
      <ScrollView ref={scroll} contentContainerStyle={s.body}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile label="Jobs" value={String(shown?.jobs ?? 0)} />
          <StatTile label="Collected" value={fmtL(shown?.litres ?? 0).replace(' L', '')} />
          <StatTile label="On road" value={shown ? fmtMin(shown.minutes) || '0' : '0'} />
          <StatTile label="Slow legs" value={String(shown?.slow ?? 0)} color={shown?.slow ? c.dangerText : undefined} />
          <StatTile label="Flags" value={String(shown?.flags ?? 0)} color={shown?.flags ? c.warningText : undefined} />
        </View>

        <SectionCard title={isToday ? "Today's legs" : `${shortDay(day)} · legs`}
          sub={shown ? `Started ${fmtTime(shown.firstAt)} · ${shown.events.length} stop${shown.events.length === 1 ? '' : 's'}` : isToday ? 'No activity recorded today' : 'No activity that day'}
          right={!isToday ? <Text onPress={() => setDay(todayKey)} style={s.link}>Today</Text> : undefined}>
          <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            {legs.map((l, i) => {
              const e = l.event
              const flags = e.kind === 'pickup' ? e.flags : []
              const col = e.kind === 'unload' ? c.warning : e.kind === 'transfer' ? c.faint : c.success
              return (
                <View key={e.id} style={s.leg}>
                  <View style={s.rail}><View style={[s.pt, { backgroundColor: col }]} />{i < legs.length - 1 || (v.ongoing && isToday) ? <View style={s.line} /> : null}</View>
                  <View style={{ flex: 1, gap: 2, paddingBottom: 14 }}>
                    <Text style={s.legTitle} numberOfLines={2}>{title(e)}</Text>
                    <Text style={s.legSub} numberOfLines={2}>{[l.fromAt ? `from ${fmtTime(l.fromAt)}` : null, fmtMin(l.minutes), l.metres != null ? fmtM(l.metres) : null].filter(Boolean).join(' · ') || 'First stop'}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      {l.slow ? <Tag label={`Slow leg · +${fmtMin(l.over!)} over a ${fmtMin(l.expected!)} drive`} tone="amber" /> : null}
                      {flags.includes('nolocation') ? <Tag label="No GPS" tone="amber" /> : null}
                      {flags.includes('location') ? <Tag label="Away from device" tone="amber" /> : null}
                      {flags.includes('capacity') ? <Tag label="Over capacity" tone="rose" /> : null}
                    </View>
                  </View>
                  <Text style={s.time}>{fmtTime(e.at)}</Text>
                </View>
              )
            })}
            {v.ongoing && isToday ? (
              <View style={s.leg}>
                <View style={s.rail}><View style={[s.pt, { backgroundColor: c.primary }]} /></View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.legTitle}>{deviceTitle(ix.devices.get(v.ongoing.deviceId || ''), ix.locations.get(v.ongoing.locationId || ''))} · in progress</Text>
                  <Text style={s.legSub}>Started {fmtTime(v.ongoing.startAt)}</Text>
                </View>
                <Text style={s.time}>{fmtTime(v.ongoing.startAt)}</Text>
              </View>
            ) : null}
            {!legs.length && !(v.ongoing && isToday) ? <Text style={s.emptyInline}>Nothing recorded.</Text> : null}
          </View>
        </SectionCard>

        <SectionCard title="Working days" sub={v.days.length ? `${v.days.length} day${v.days.length === 1 ? '' : 's'} with activity · tap one to see its legs above` : 'No activity recorded yet'}>
          {v.days.slice(0, 30).map((d, i) => (
            <View key={d.day} style={d.day === day ? { backgroundColor: c.primaryTint } : undefined}>
              <ARow title={d.day === todayKey ? `Today · ${fmtDay(d.day + 'T12:00:00')}` : fmtDay(d.day + 'T12:00:00')} subtitle={`${d.jobs} job${d.jobs === 1 ? '' : 's'} · ${fmtL(d.litres)} · ${fmtMin(d.minutes) || '—'}`}
                right={<View style={{ flexDirection: 'row', gap: 6 }}>{d.slow ? <Tag label={`${d.slow} slow leg${d.slow === 1 ? '' : 's'}`} tone="rose" /> : null}{d.flags ? <Tag label={`${d.flags} flag${d.flags === 1 ? '' : 's'}`} tone="amber" /> : null}{d.day === day ? <Tag label="Showing" tone="blue" /> : null}</View>}
                onPress={() => pick(d.day)} last={i === Math.min(v.days.length, 30) - 1} />
            </View>
          ))}
        </SectionCard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  chip: { paddingHorizontal: 12, height: 44, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, justifyContent: 'center', gap: 1, minWidth: 86 },
  chipOn: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { fontSize: 12.5, fontWeight: '600', color: c.text },
  chipTextOn: { color: '#fff' },
  chipSub: { fontSize: 10.5, color: c.faint },
  link: { fontSize: 12, fontWeight: '600', color: c.primary },
  leg: { flexDirection: 'row', gap: 10 },
  rail: { width: 14, alignItems: 'center' },
  pt: { width: 12, height: 12, borderRadius: 6, borderWidth: 2.5, borderColor: '#fff', marginTop: 3, shadowColor: '#94a3b8', shadowOpacity: 1, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } },
  line: { flex: 1, width: 2, backgroundColor: c.border, marginTop: 2 },
  legTitle: { fontSize: 13, fontWeight: '600', color: c.text },
  legSub: { fontSize: 11.5, color: c.faint },
  time: { fontSize: 11.5, color: c.faint, width: 44, textAlign: 'right', fontFamily: 'Menlo' },
  empty: { fontSize: 13, color: c.faint, padding: 14, textAlign: 'center' },
  emptyInline: { fontSize: 13, color: c.faint, paddingVertical: 6 },
})
