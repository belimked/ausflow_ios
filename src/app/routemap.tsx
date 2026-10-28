import { AppleMaps } from 'expo-maps'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ACard, Tag } from '@/components/admin'
import { Icon } from '@/components/ui'
import { legsOf, workDays, type DayEvent } from '@/lib/admin'
import { deviceTitle, fmtDay, fmtL, fmtM, fmtTime } from '@/lib/format'
import { distanceM } from '@/lib/geo'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

// One colour per leg, same palette as the web console's driver map.
const PALETTE = ['#0369a1', '#059669', '#d97706', '#7c3aed', '#0e7490', '#e11d48', '#4f46e5', '#b45309']
const fmtMin = (m: number | null) => (m == null ? '' : m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`)

export default function RouteMap() {
  const { driverId, day } = useLocalSearchParams<{ driverId: string; day?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data } = useStore()
  const ix = useIndex()
  const [picked, setPicked] = useState<number | null>(null)
  const driver = ix.drivers.get(driverId)

  const v = useMemo(() => {
    if (!data) return null
    const days = workDays(data, { driverId })
    const key = day || new Date().toISOString().slice(0, 10)
    const d = days.find((x) => x.day === key) || days[0]
    const legs = d ? legsOf(d.events, distanceM) : []
    const ongoing = data.pickups.find((p) => p.status === 'ongoing' && p.driverId === driverId)
    const pts = legs.map((l) => l.event).filter((e) => e.lat != null && e.lng != null)
    const centre = pts.length ? { latitude: pts.reduce((n, e) => n + e.lat!, 0) / pts.length, longitude: pts.reduce((n, e) => n + e.lng!, 0) / pts.length } : { latitude: -27.47, longitude: 153.02 }
    const polylines = legs.map((l, i) => {
      const prev = i ? legs[i - 1].event : null
      const e = l.event
      if (!prev || prev.lat == null || e.lat == null) return null
      return { id: String(i), coordinates: [{ latitude: prev.lat!, longitude: prev.lng! }, { latitude: e.lat!, longitude: e.lng! }], color: PALETTE[i % PALETTE.length], width: picked == null || picked === i ? 5 : 2 }
    }).filter(Boolean) as { id: string; coordinates: { latitude: number; longitude: number }[]; color: string; width: number }[]
    const markers = legs.map((l, i) => {
      const e = l.event
      if (e.lat == null) return null
      return { id: String(i), coordinates: { latitude: e.lat!, longitude: e.lng! }, tintColor: PALETTE[i % PALETTE.length], monogram: e.kind === 'unload' ? 'U' : e.kind === 'transfer' ? 'T' : String(i + 1), title: titleOf(e) }
    }).filter(Boolean) as { id: string; coordinates: { latitude: number; longitude: number }; tintColor: string; monogram: string; title: string }[]
    if (ongoing?.startLat != null) markers.push({ id: 'now', coordinates: { latitude: ongoing.startLat!, longitude: ongoing.startLng! }, tintColor: c.primary, monogram: '●', title: 'In progress now' })
    return { d, legs, centre, polylines, markers, ongoing, km: legs.reduce((n, l) => n + (l.metres || 0), 0) }
  }, [data, driverId, day, picked, ix]) // eslint-disable-line react-hooks/exhaustive-deps

  function titleOf(e: DayEvent) {
    if (e.kind === 'pickup') return `${deviceTitle(ix.devices.get(e.ref.deviceId || ''), ix.locations.get(e.ref.locationId || ''))} · ${fmtL(e.volume)}`
    if (e.kind === 'unload') return `Unload · ${ix.facilities.get(e.facilityId || '')?.name || 'Facility'} · ${fmtL(e.volume)}`
    return `Transfer ${e.out ? 'to' : 'from'} ${ix.vehicles.get(e.otherVehicleId)?.plate || 'truck'} · ${fmtL(e.volume)}`
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === 'ios' && v ? (
        <AppleMaps.View style={StyleSheet.absoluteFill} cameraPosition={{ coordinates: v.centre, zoom: 12 }} markers={v.markers} polylines={v.polylines}
          onMarkerClick={(m) => { if (m.id && m.id !== 'now') setPicked(Number(m.id)) }} uiSettings={{ compassEnabled: true, myLocationButtonEnabled: false, scaleBarEnabled: false, togglePitchEnabled: false }} />
      ) : null}
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} style={s.btn} accessibilityRole="button" accessibilityLabel="Back"><Icon name="chevron.left" size={18} color={c.body} /></Pressable>
        <View style={[s.chipBox, { flex: 1 }]}>
          <Text style={s.chipTitle} numberOfLines={1}>{driver?.name || 'Driver'} · {v?.d ? (v.d.day === new Date().toISOString().slice(0, 10) ? 'Today' : fmtDay(v.d.day + 'T12:00:00')) : day ? fmtDay(day + 'T12:00:00') : 'Today'}</Text>
          <Text style={s.chipSub} numberOfLines={1}>{v?.d ? `${v.d.jobs} jobs · ${fmtL(v.d.litres)} · ${fmtM(v.km)} straight-line` : 'No activity recorded'}</Text>
        </View>
        {v?.ongoing ? <Tag label="Live" tone="blue" /> : null}
      </View>

      <ACard style={[s.sheet, { paddingBottom: insets.bottom + 8 }]}>
        <View style={s.handle} />
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><Text style={s.title}>Legs</Text><View style={{ flex: 1 }} /><Text style={s.hint}>tap a leg or pin to highlight</Text></View>
        <ScrollView style={{ maxHeight: 190 }}>
          {v?.legs.map((l, i) => {
            const e = l.event
            const on = picked === i
            return (
              <Text key={e.id} onPress={() => setPicked(on ? null : i)} style={[s.leg, on && { backgroundColor: c.primaryTint }]}>
                <Text style={{ color: PALETTE[i % PALETTE.length], fontWeight: '800' }}>{e.kind === 'unload' ? 'U' : e.kind === 'transfer' ? 'T' : i + 1}  </Text>
                <Text style={{ color: c.text, fontWeight: on ? '700' : '500' }}>{titleOf(e)}</Text>
                <Text style={{ color: c.faint }}>  {[fmtMin(l.minutes), l.metres != null ? fmtM(l.metres) : null, l.fast ? `fast ${Math.round(l.kmh!)} km/h` : null, l.slow ? `slow +${fmtMin(l.over!)}` : null].filter(Boolean).join(' · ')}  {fmtTime(e.at)}</Text>
              </Text>
            )
          })}
          {!v?.legs.length ? <Text style={s.hint}>No GPS points for this day.</Text> : null}
        </ScrollView>
      </ACard>
    </View>
  )
}

const s = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, top: 0, flexDirection: 'row', alignItems: 'center', gap: 10 },
  btn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.95)', borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', shadowColor: '#0f172a', shadowOpacity: 0.12, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  chipBox: { height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.95)', justifyContent: 'center', paddingHorizontal: 12 },
  chipTitle: { fontSize: 13, fontWeight: '600', color: c.text },
  chipSub: { fontSize: 11, color: c.faint, fontFamily: 'Menlo' },
  sheet: { position: 'absolute', left: 16, right: 16, bottom: 0, padding: 12, paddingHorizontal: 14, gap: 8, borderRadius: 18 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginTop: -2 },
  title: { fontSize: 14, fontWeight: '700', color: c.text },
  hint: { fontSize: 11, color: c.faint },
  leg: { fontSize: 12.5, lineHeight: 18, paddingVertical: 6, paddingHorizontal: 6, borderRadius: 6 },
})
