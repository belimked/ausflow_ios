import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { AHeader, ARow, IconButton, Segmented, Tag } from '@/components/admin'
import { Icon } from '@/components/ui'
import { deviceCounts, filterDevices, sortByDue, type DeviceFilter } from '@/lib/admin'
import { addressOf, deviceTitle, dueState, fmtL } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'
import type { Device } from '@/lib/types'

const FILTERS: { key: DeviceFilter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'overdue', label: 'Overdue' }, { key: 'soon', label: 'Due soon' }, { key: 'inactive', label: 'Inactive' },
]
const TONE = { overdue: 'rose', soon: 'amber', ok: 'green', unknown: 'slate' } as const

export default function AdminDevices() {
  const router = useRouter()
  const params = useLocalSearchParams<{ filter?: DeviceFilter; company?: string }>()
  const { data, loading, refresh, canWrite } = useStore()
  const ix = useIndex()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<DeviceFilter>(params.filter || 'all')
  const [company, setCompany] = useState<string | null>(params.company ?? null)
  // A dashboard card navigates here with new params; adopt them once (the "previous props in state" pattern).
  const [seen, setSeen] = useState({ filter: params.filter, company: params.company })
  if (seen.filter !== params.filter || seen.company !== params.company) {
    setSeen({ filter: params.filter, company: params.company })
    if (params.filter) setFilter(params.filter)
    if (params.company !== undefined) setCompany(params.company || null)
  }

  const counts = useMemo(() => deviceCounts(data?.devices || []), [data])
  const companies = useMemo(() => {
    const used = new Set((data?.devices || []).map((d) => d.companyId).filter(Boolean) as string[])
    return (data?.companies || []).filter((co) => used.has(co.id)).sort((a, b) => a.name.localeCompare(b.name))
  }, [data])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = filterDevices(data?.devices || [], filter).filter((d) => {
      if (company && d.companyId !== company) return false
      if (!needle) return true
      const loc = d.locationId ? ix.locations.get(d.locationId) : undefined
      return [d.ref, d.aka, d.qr, d.tags, d.locationDesc, loc?.name, addressOf(loc), ix.companies.get(d.companyId || '')?.name]
        .some((v) => v && v.toLowerCase().includes(needle))
    })
    return sortByDue(list)
  }, [data, q, filter, company, ix])

  function render({ item: d, index }: { item: Device; index: number }) {
    const loc = d.locationId ? ix.locations.get(d.locationId) : undefined
    const due = dueState(d)
    const busy = ix.ongoingByDevice.get(d.id)
    const co = ix.companies.get(d.companyId || '')?.name
    return (
      <ARow testID={`device-row-${d.id}`} icon="drop.fill" iconTone={busy ? 'blue' : TONE[due.state]} last={index === rows.length - 1} onPress={() => router.push(`/device/${d.id}`)}
        title={deviceTitle(d, loc)}
        subtitle={<Text style={s.sub} numberOfLines={1}><Text style={s.mono}>{d.ref}</Text>{loc ? ` · ${addressOf(loc)}` : d.locationDesc ? ` · ${d.locationDesc}` : ''}</Text>}
        right={
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            {busy ? <Tag label="In progress" tone="blue" /> : <Tag label={due.label} tone={TONE[due.state]} />}
            <Text style={s.meta} numberOfLines={1}>{[d.capacity ? fmtL(d.capacity) : null, co].filter(Boolean).join(' · ')}</Text>
          </View>
        } />
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AHeader eyebrow="ASSETS" title="Devices" subtitle={`${counts.all} active · ${counts.inactive} inactive`}
        right={canWrite ? <IconButton name="qrcode.viewfinder" label="Scan device QR" onPress={() => router.push('/scan')} /> : undefined}>
        <View style={s.search}>
          <Icon name="magnifyingglass" size={15} color={c.faint} />
          <TextInput testID="admin-devices-search" value={q} onChangeText={setQ} placeholder="Device ID, site, address, company" placeholderTextColor={c.ghost}
            style={s.input} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" returnKeyType="search" />
        </View>
        <Segmented options={FILTERS.map((f) => ({ ...f, count: counts[f.key] }))} value={filter} onChange={setFilter} />
      </AHeader>
      {companies.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
          <Chip label="All companies" on={!company} onPress={() => setCompany(null)} />
          {companies.map((co) => <Chip key={co.id} label={co.name} on={company === co.id} onPress={() => setCompany(company === co.id ? null : co.id)} />)}
        </ScrollView>
      ) : null}
      <FlatList data={rows} keyExtractor={(d) => d.id} renderItem={render} keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.list} style={{ flex: 1 }}
        ListHeaderComponent={<Text style={s.sorted}>{rows.length} device{rows.length === 1 ? '' : 's'} · sorted by <Text style={{ color: c.text, fontWeight: '600' }}>most overdue</Text></Text>}
        ListEmptyComponent={<Text style={s.empty}>{data ? 'No devices match.' : 'Loading…'}</Text>}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} />} />
    </View>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: c.primary, borderColor: c.primary }]}>
      <Text style={[s.chipText, on && { color: '#fff' }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  )
}

const s = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 38, paddingHorizontal: 12, borderRadius: 9, backgroundColor: c.hairline, borderWidth: 1, borderColor: c.border },
  input: { flex: 1, fontSize: 14, color: c.text, height: 38 },
  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 6 },
  chip: { height: 28, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '500', color: c.muted },
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  sorted: { fontSize: 12, color: c.faint, paddingVertical: 8, paddingHorizontal: 2 },
  sub: { fontSize: 11.5, color: c.faint },
  mono: { fontFamily: 'Menlo', color: c.primary },
  meta: { fontSize: 11, color: c.ghost },
  empty: { fontSize: 13, color: c.faint, textAlign: 'center', paddingVertical: 32 },
})
