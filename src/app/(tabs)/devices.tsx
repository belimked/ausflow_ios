import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native'
import { DeviceRow } from '@/components/items'
import { Chip, EmptyState, Icon, ScreenHeader } from '@/components/ui'
import { addressOf, dueState, nextService } from '@/lib/format'
import { currentCoords, distanceM } from '@/lib/geo'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'
import type { Coords } from '@/lib/types'

export default function Devices() {
  const router = useRouter()
  const { data, profile, loading, refresh, canWrite } = useStore()
  const ix = useIndex()
  const [q, setQ] = useState('')
  const [mineOnly, setMineOnly] = useState(!!profile)
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [here, setHere] = useState<Coords | null>(null)
  const [locating, setLocating] = useState(false)

  async function toggleNearby() {
    if (here) return setHere(null)
    setLocating(true)
    const c = await currentCoords()
    setLocating(false)
    if (!c) return Alert.alert('Location unavailable', 'Allow location access in Settings to sort devices by distance.')
    setHere(c)
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (data?.devices || []).filter((d) => {
      if (mineOnly && profile && d.companyId !== profile.companyId) return false
      if (overdueOnly && dueState(d).state !== 'overdue') return false
      if (!needle) return true
      const loc = d.locationId ? ix.locations.get(d.locationId) : undefined
      return [d.ref, d.aka, d.qr, d.tags, d.locationDesc, loc?.name, addressOf(loc)].some((v) => v && v.toLowerCase().includes(needle))
    }).map((d) => ({ d, dist: here ? distanceM(here.lat, here.lng, d.lat, d.lng) : null }))
    if (here) list.sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity))
    else list.sort((a, b) => (nextService(a.d) || '9').localeCompare(nextService(b.d) || '9'))
    return list
  }, [data, q, mineOnly, overdueOnly, here, profile, ix])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Devices" subtitle={`${rows.length} shown`} right={canWrite ? (
        <Pressable onPress={() => router.push(profile ? '/scan' : '/setup')} hitSlop={8} style={s.scanBtn}>
          <Icon name="qrcode.viewfinder" size={20} color="#fff" />
        </Pressable>
      ) : null} />
      <View style={s.search}>
        <Icon name="magnifyingglass" size={16} color={colors.faint} />
        <TextInput value={q} onChangeText={setQ} placeholder="Name, address, ref or QR code" placeholderTextColor={colors.faint}
          style={s.input} autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search" />
      </View>
      <View style={s.chips}>
        {profile ? <Chip label="My company" icon="building.2.fill" active={mineOnly} onPress={() => setMineOnly((v) => !v)} /> : null}
        <Chip label="Overdue" icon="exclamationmark.triangle.fill" active={overdueOnly} onPress={() => setOverdueOnly((v) => !v)} />
        <Chip label={locating ? 'Locating…' : 'Nearby'} icon="location.fill" active={!!here} onPress={toggleNearby} />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.d.id}
        keyboardDismissMode="on-drag"
        initialNumToRender={14}
        contentContainerStyle={{ padding: 16, paddingTop: 8, gap: 8 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        renderItem={({ item }) => <View style={s.card}><DeviceRow device={item.d} distance={item.dist} /></View>}
        ListEmptyComponent={<EmptyState icon="magnifyingglass" title="No devices found" message="Try a different search or clear the filters." />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  scanBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, height: 44, borderRadius: 12, backgroundColor: '#E7ECF1', paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16, color: colors.text, height: '100%' },
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden' },
})
