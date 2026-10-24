import { AppleMaps } from 'expo-maps'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Linking, Platform, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ACard, Segmented, Tag } from '@/components/admin'
import { Icon } from '@/components/ui'
import { addressOf, deviceTitle, dueState } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'
import type { Device } from '@/lib/types'

type Filter = 'overdue' | 'soon' | 'all'
const TINT = { overdue: '#e11d48', soon: '#d97706', ok: '#059669', unknown: '#94a3b8' } as const
const TONE = { overdue: 'rose', soon: 'amber', ok: 'green', unknown: 'slate' } as const

// Device map: devices with coordinates as pins tinted by due state, centred on the device or location that
// opened it. Apple MapKit through expo-maps (iOS 17+).
export default function MapScreen() {
  const { deviceId, locationId } = useLocalSearchParams<{ deviceId?: string; locationId?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data } = useStore()
  const ix = useIndex()
  const [filter, setFilter] = useState<Filter>('overdue')
  const focusDevice = deviceId ? ix.devices.get(deviceId) : undefined
  const [selected, setSelected] = useState<string | null>(focusDevice?.locationId || locationId || null)

  const v = useMemo(() => {
    const all = (data?.devices || []).filter((d) => d.lat != null && d.lng != null)
    const shown = all.filter((d) => {
      if (d.id === deviceId) return true
      const st = dueState(d).state
      return filter === 'all' ? d.status === 'Active' : st === filter
    })
    const centre = focusDevice?.lat != null ? { latitude: focusDevice.lat!, longitude: focusDevice.lng! }
      : (() => { const d = all.find((x) => x.locationId === locationId) || shown[0] || all[0]; return d ? { latitude: d.lat!, longitude: d.lng! } : { latitude: -27.47, longitude: 153.02 } })()
    const bySite = new Map<string, Device[]>()
    for (const d of shown) { const k = d.locationId || d.id; bySite.set(k, [...(bySite.get(k) || []), d]) }
    return { shown, centre, bySite }
  }, [data, filter, deviceId, locationId, focusDevice])

  const site = selected ? v.bySite.get(selected) || (data?.devices || []).filter((d) => (d.locationId || d.id) === selected) : []
  const loc = selected ? ix.locations.get(selected) : undefined
  const first = site[0]
  const title = loc?.name || deviceTitle(first, loc)
  const counts = { overdue: site.filter((d) => dueState(d).state === 'overdue').length }

  const markers = v.shown.map((d) => {
    const st = dueState(d).state
    const n = v.bySite.get(d.locationId || d.id)?.length || 1
    return { id: d.locationId || d.id, coordinates: { latitude: d.lat!, longitude: d.lng! }, tintColor: TINT[st], monogram: n > 1 ? String(n) : undefined, systemImage: n > 1 ? undefined : 'drop.fill', title: deviceTitle(d, ix.locations.get(d.locationId || '')) }
  })

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === 'ios' ? (
        <AppleMaps.View style={StyleSheet.absoluteFill} cameraPosition={{ coordinates: v.centre, zoom: focusDevice || locationId ? 15 : 12 }} markers={markers}
          onMarkerClick={(m) => { if (m.id) setSelected(m.id) }} uiSettings={{ compassEnabled: true, myLocationButtonEnabled: false, scaleBarEnabled: false, togglePitchEnabled: false }} properties={{ isMyLocationEnabled: true }} />
      ) : <Text style={s.empty}>Maps are available on iOS only.</Text>}

      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text onPress={() => router.back()} style={s.btn} accessibilityRole="button" accessibilityLabel="Back"><Icon name="chevron.left" size={18} color={c.body} /></Text>
          <View style={[s.chipBox, { flex: 1 }]}><Text style={s.chipText} numberOfLines={1}>{v.shown.length} device{v.shown.length === 1 ? '' : 's'} on map · {v.bySite.size} site{v.bySite.size === 1 ? '' : 's'}</Text></View>
        </View>
        <Segmented options={[{ key: 'overdue', label: 'Overdue' }, { key: 'soon', label: 'Due soon' }, { key: 'all', label: 'All active' }] as { key: Filter; label: string }[]} value={filter} onChange={setFilter} style={s.seg} />
      </View>

      {first ? (
        <ACard style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.handle} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[s.pin, { backgroundColor: counts.overdue ? c.dangerSoft : c.successSoft }]}><Icon name="mappin.and.ellipse" size={18} color={counts.overdue ? c.danger : c.success} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.title} numberOfLines={1}>{title}</Text>
              <Text style={s.sub} numberOfLines={1}>{addressOf(loc) || first.locationDesc || `${first.lat?.toFixed(4)}, ${first.lng?.toFixed(4)}`} · {site.length} device{site.length === 1 ? '' : 's'}{counts.overdue ? ` · ${counts.overdue} overdue` : ''}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {site.slice(0, 4).map((d) => {
              const st = dueState(d)
              return (
                <Text key={d.id} onPress={() => router.push(`/device/${d.id}`)} style={s.dev}>
                  <Text style={{ fontFamily: 'Menlo', color: c.primary, fontWeight: '600' }}>{d.ref}</Text>{'\n'}<Tag label={st.label} tone={TONE[st.state]} />
                </Text>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {loc ? <Text onPress={() => router.push(`/location/${loc.id}`)} style={s.action}>Location details</Text> : null}
            <Text onPress={() => Linking.openURL(`maps://?q=${encodeURIComponent(title)}&ll=${first.lat},${first.lng}`)} style={[s.action, s.actionPrimary]}>Open in Apple Maps</Text>
          </View>
        </ACard>
      ) : null}
    </View>
  )
}

const s = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, top: 0, gap: 10 },
  btn: { width: 40, height: 40, lineHeight: 40, textAlign: 'center', borderRadius: 10, backgroundColor: 'rgba(255,255,255,.95)', overflow: 'hidden' },
  chipBox: { height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.95)', justifyContent: 'center', paddingHorizontal: 12 },
  chipText: { fontSize: 13, color: c.muted },
  seg: { backgroundColor: 'rgba(255,255,255,.92)', alignSelf: 'flex-start' },
  sheet: { position: 'absolute', left: 16, right: 16, bottom: 0, padding: 14, gap: 12, borderRadius: 18 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: c.border, alignSelf: 'center', marginTop: -4 },
  pin: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700', color: c.text },
  sub: { fontSize: 11.5, color: c.faint },
  dev: { flexBasis: '47%', flexGrow: 1, padding: 8, paddingHorizontal: 10, borderRadius: 8, backgroundColor: c.bg, borderWidth: 1, borderColor: c.border, fontSize: 12, lineHeight: 20 },
  action: { flex: 1, height: 40, lineHeight: 40, textAlign: 'center', borderRadius: 9, backgroundColor: c.field, color: c.primary, fontSize: 13, fontWeight: '500', overflow: 'hidden' },
  actionPrimary: { backgroundColor: c.primary, color: '#fff' },
  empty: { fontSize: 13, color: c.faint, textAlign: 'center', marginTop: 200 },
})
