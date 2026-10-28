import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native'
import { ACard, AHeader, ARow, Segmented, Tag } from '@/components/admin'
import { Icon } from '@/components/ui'
import { activeDriverIds, dueBuckets, isOccupier, isTransport } from '@/lib/admin'
import { addressOf, dueState, fmtL } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

type Tab = 'transport' | 'occupiers' | 'drivers' | 'vehicles' | 'locations' | 'facilities'
const TITLE: Record<Tab, string> = { transport: 'Transport companies', occupiers: 'Occupiers', drivers: 'Drivers', vehicles: 'Vehicles', locations: 'Locations', facilities: 'Facilities' }
interface Row { id: string; title: string; sub: string; tag?: { label: string; tone: 'green' | 'amber' | 'rose' | 'slate' | 'blue' }; icon: 'building.2.fill' | 'storefront.fill' | 'person.fill' | 'truck.box.fill' | 'mappin.and.ellipse' | 'building.columns.fill'; to: string }

export default function Directory() {
  const router = useRouter()
  const params = useLocalSearchParams<{ tab?: Tab }>()
  const { data } = useStore()
  const ix = useIndex()
  const [tab, setTab] = useState<Tab>(params.tab || 'transport')
  const [q, setQ] = useState('')

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const needle = q.trim().toLowerCase()
    let out: Row[] = []
    if (tab === 'transport') {
      out = data.companies.filter((co) => isTransport(co) || data.devices.some((d) => ix.servicedBy.get(d.id) === co.id)).map((co) => {
        const devs = data.devices.filter((d) => ix.servicedBy.get(d.id) === co.id)
        const b = dueBuckets(devs)
        return { id: co.id, icon: 'building.2.fill', title: co.name, to: `/company/${co.id}`,
          sub: `${data.drivers.filter((d) => d.companyId === co.id).length} drivers · ${data.vehicles.filter((v) => v.companyId === co.id).length} vehicles · ${b.active} devices`,
          tag: { label: b.overdue ? `${b.overdue} overdue` : 'OK', tone: b.overdue > 2 ? 'rose' : b.overdue ? 'amber' : 'green' } }
      })
    } else if (tab === 'occupiers') {
      out = data.companies.filter((co) => isOccupier(co) || data.devices.some((d) => d.ownerId === co.id)).map((co) => {
        const devs = data.devices.filter((d) => d.ownerId === co.id)
        const b = dueBuckets(devs)
        const locs = new Set(devs.map((d) => d.locationId).filter(Boolean)).size
        return { id: co.id, icon: 'storefront.fill', title: co.name, to: `/occupier/${co.id}`,
          sub: `${locs} location${locs === 1 ? '' : 's'} · ${devs.length} device${devs.length === 1 ? '' : 's'}`,
          tag: b.overdue ? { label: `${b.overdue} overdue`, tone: 'rose' } : devs.length ? { label: 'OK', tone: 'green' } : undefined }
      })
    } else if (tab === 'drivers') {
      const today = activeDriverIds(data, 1)
      const ongoing = new Set(data.pickups.filter((p) => p.status === 'ongoing').map((p) => p.driverId))
      out = data.drivers.map((d) => ({ id: d.id, icon: 'person.fill', title: d.name, to: `/driver/${d.id}`,
        sub: [ix.companies.get(d.companyId || '')?.name, d.phone].filter(Boolean).join(' · ') || 'Driver',
        tag: ongoing.has(d.id) ? { label: 'On job', tone: 'blue' } : today.has(d.id) ? { label: 'Today', tone: 'green' } : d.status && d.status !== 'Active' ? { label: d.status, tone: 'slate' } : undefined }))
    } else if (tab === 'vehicles') {
      out = data.vehicles.map((v) => {
        const load = ix.loads.get(v.id) || 0
        return { id: v.id, icon: 'truck.box.fill', title: v.plate, to: `/vehicle/${v.id}`,
          sub: [ix.companies.get(v.companyId || '')?.name, v.type, v.tank ? `${fmtL(v.tank)} tank` : null].filter(Boolean).join(' · ') || 'Vehicle',
          tag: load ? { label: `${fmtL(load)} on board`, tone: v.tank && load > v.tank ? 'rose' : 'blue' } : { label: 'Empty', tone: 'slate' } }
      })
    } else if (tab === 'locations') {
      out = data.locations.map((l) => {
        const devs = data.devices.filter((d) => d.locationId === l.id)
        const worst = devs.map((d) => dueState(d)).sort((a, b) => a.days - b.days)[0]
        const tone = { overdue: 'rose', soon: 'amber', ok: 'green', unknown: 'slate' } as const
        return { id: l.id, icon: 'mappin.and.ellipse', title: l.name, to: `/location/${l.id}`,
          sub: `${addressOf(l) || l.id} · ${devs.length} device${devs.length === 1 ? '' : 's'}`, tag: worst ? { label: worst.label, tone: tone[worst.state] } : undefined }
      })
    } else {
      out = data.facilities.map((f) => {
        const n = data.unloads.filter((u) => u.facilityId === f.id).length
        return { id: f.id, icon: 'building.columns.fill', title: f.name, to: '', sub: `${f.address || f.id} · ${n} unload${n === 1 ? '' : 's'}`,
          tag: f.status && f.status !== 'Active' ? { label: f.status, tone: 'slate' } : undefined }
      })
    }
    if (needle) out = out.filter((r) => `${r.title} ${r.sub}`.toLowerCase().includes(needle))
    // A–Z by name / plate, the same order as the web console's lists; status shows in the tag, not the order.
    return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }))
  }, [data, tab, q, ix])

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="COMPANIES & PEOPLE" title={TITLE[tab]} subtitle={`${rows.length}`} back={() => router.back()}>
        <View style={s.search}>
          <Icon name="magnifyingglass" size={15} color={c.faint} />
          <TextInput value={q} onChangeText={setQ} placeholder="Company, driver, rego, site" placeholderTextColor={c.ghost} style={s.input} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" />
        </View>
        <Segmented options={[{ key: 'transport', label: 'Transport' }, { key: 'occupiers', label: 'Occupiers' }, { key: 'drivers', label: 'Drivers' }, { key: 'vehicles', label: 'Vehicles' }, { key: 'locations', label: 'Locations' }, { key: 'facilities', label: 'Facilities' }] as { key: Tab; label: string }[]} value={tab} onChange={setTab} />
      </AHeader>
      <FlatList data={rows.slice(0, 300)} keyExtractor={(r) => r.id} contentContainerStyle={s.list} keyboardShouldPersistTaps="handled"
        renderItem={({ item: r, index }) => (
          <ACard style={{ borderRadius: 0, borderTopWidth: index ? 0 : 1, ...(index === 0 ? { borderTopLeftRadius: 12, borderTopRightRadius: 12 } : {}), ...(index === Math.min(rows.length, 300) - 1 ? { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 } : {}) }}>
            <ARow testID={`directory-row-${r.id}`} icon={r.icon} iconTone={r.tag?.tone === 'rose' ? 'rose' : r.tag?.tone === 'amber' ? 'amber' : 'blue'} title={r.title} subtitle={r.sub}
              right={r.tag ? <Tag label={r.tag.label} tone={r.tag.tone} /> : undefined} last onPress={r.to ? () => router.push(r.to as any) : undefined} />
          </ACard>
        )}
        ListEmptyComponent={<Text style={s.empty}>{data ? 'Nothing matches.' : 'Loading…'}</Text>} />
    </View>
  )
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 9, backgroundColor: c.hairline, borderWidth: 1, borderColor: c.border },
  input: { flex: 1, fontSize: 14, color: c.text, height: 38 },
  list: { padding: 16, paddingBottom: 60 },
  empty: { fontSize: 13, color: c.faint, textAlign: 'center', paddingVertical: 32 },
})
