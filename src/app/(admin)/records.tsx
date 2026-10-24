import { useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, DayHeader, Segmented, StatTile, Tag } from '@/components/admin'
import { FlagPills } from '@/components/items'
import { fmtDay, fmtL, fmtTime, fmtDuration, deviceTitle, startOfDay } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'
import type { Pickup, Transfer, Unload } from '@/lib/types'

type Kind = 'pickups' | 'transfers' | 'unloads'
type Range = '7' | '30' | '90'
type Item = { id: string; at: string; volume: number } & (
  | { kind: 'pickup'; ref: Pickup } | { kind: 'unload'; ref: Unload } | { kind: 'transfer'; ref: Transfer })

const DAY = 864e5

export default function AdminRecords() {
  const router = useRouter()
  const { data, loading, refresh } = useStore()
  const ix = useIndex()
  const [kind, setKind] = useState<Kind>('pickups')
  const [range, setRange] = useState<Range>('7')

  const v = useMemo(() => {
    const from = startOfDay() - (Number(range) - 1) * DAY
    const inRange = (at?: string | null) => !!at && new Date(at).getTime() >= from
    const pickups = (data?.pickups || []).filter((p) => p.status === 'ongoing' || inRange(p.endAt))
    const transfers = (data?.transfers || []).filter((t) => inRange(t.at))
    const unloads = (data?.unloads || []).filter((u) => inRange(u.at))
    const counts = { pickups: pickups.length, transfers: transfers.length, unloads: unloads.length }
    let items: Item[]
    if (kind === 'pickups') items = pickups.map((p) => ({ kind: 'pickup', id: p.id, at: p.status === 'ongoing' ? p.startAt || '' : p.endAt || '', volume: p.volume || 0, ref: p }))
    else if (kind === 'transfers') items = transfers.map((t) => ({ kind: 'transfer', id: t.id, at: t.at, volume: t.volume || 0, ref: t }))
    else items = unloads.map((u) => ({ kind: 'unload', id: u.id, at: u.at, volume: u.volume || 0, ref: u }))
    items.sort((a, b) => b.at.localeCompare(a.at))
    const sections: { title: string; data: Item[]; litres: number }[] = []
    const ongoing = items.filter((it) => it.kind === 'pickup' && it.ref.status === 'ongoing')
    if (ongoing.length) sections.push({ title: 'In progress', data: ongoing, litres: 0 })
    const groups = new Map<string, Item[]>()
    for (const it of items) {
      if (it.kind === 'pickup' && it.ref.status === 'ongoing') continue
      const k = fmtDay(it.at)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(it)
    }
    for (const [title, list] of groups) sections.push({ title, data: list, litres: list.reduce((n, it) => n + it.volume, 0) })
    const done = items.filter((it) => !(it.kind === 'pickup' && it.ref.status === 'ongoing'))
    const drivers = new Set(done.map((it) => it.ref.driverId).filter(Boolean)).size
    return { sections, counts, jobs: done.length, litres: done.reduce((n, it) => n + it.volume, 0), drivers }
  }, [data, kind, range])

  const plate = (id?: string | null) => (id && ix.vehicles.get(id)?.plate) || '—'
  const who = (id?: string | null) => (id && ix.drivers.get(id)?.name) || null

  function row(it: Item, last: boolean) {
    if (it.kind === 'pickup') {
      const p = it.ref
      const dev = p.deviceId ? ix.devices.get(p.deviceId) : undefined
      const loc = p.locationId ? ix.locations.get(p.locationId) : undefined
      const ongoing = p.status === 'ongoing'
      const flagged = !!p.flags?.length
      return (
        <ARow icon={ongoing ? 'truck.box.fill' : flagged ? 'exclamationmark.triangle.fill' : 'checkmark'} iconTone={ongoing ? 'blue' : flagged ? 'amber' : 'green'} last={last}
          onPress={() => router.push(`/job/${p.id}`)} title={deviceTitle(dev, loc)}
          subtitle={<View style={{ gap: 3 }}><Text style={s.sub} numberOfLines={1}><Text style={s.mono}>{dev?.ref || ''}</Text>{[who(p.driverId), plate(p.vehicleId)].filter(Boolean).map((x) => ` · ${x}`).join('')}</Text>{flagged ? <FlagPills pickup={p} /> : null}</View>}
          right={<View style={{ alignItems: 'flex-end', gap: 3 }}>
            {ongoing ? <Tag label="Ongoing" tone="blue" /> : <Text style={s.vol}>{fmtL(p.volume)}</Text>}
            <Text style={s.meta}>{ongoing ? `started ${fmtTime(p.startAt)}` : `${fmtTime(p.endAt)}${p.startAt && p.endAt ? ` · ${fmtDuration(p.startAt, new Date(p.endAt).getTime())}` : ''}`}</Text>
          </View>} />
      )
    }
    if (it.kind === 'unload') {
      const u = it.ref
      return <ARow icon="building.columns.fill" iconTone="green" last={last} title={ix.facilities.get(u.facilityId || '')?.name || 'Facility'}
        subtitle={[plate(u.vehicleId), who(u.driverId), u.waste].filter(Boolean).join(' · ')}
        right={<View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={s.vol}>{fmtL(u.volume)}</Text><Text style={s.meta}>{fmtTime(u.at)}</Text></View>} />
    }
    const t = it.ref
    return <ARow icon="arrow.left.arrow.right" iconTone="slate" last={last} title={`${plate(t.fromVehicleId)} → ${plate(t.toVehicleId)}`}
      subtitle={who(t.driverId) || 'Transfer'}
      right={<View style={{ alignItems: 'flex-end', gap: 3 }}><Text style={s.vol}>{fmtL(t.volume)}</Text><Text style={s.meta}>{fmtTime(t.at)}</Text></View>} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AHeader eyebrow="OPERATIONS" title="Records">
        <Segmented options={[{ key: '7' as Range, label: 'Last 7 days' }, { key: '30' as Range, label: '30 days' }, { key: '90' as Range, label: '90 days' }]} value={range} onChange={setRange} />
        <Segmented options={[{ key: 'pickups' as Kind, label: 'Pump-outs', count: v.counts.pickups }, { key: 'transfers' as Kind, label: 'Transfers', count: v.counts.transfers }, { key: 'unloads' as Kind, label: 'Unloads', count: v.counts.unloads }]} value={kind} onChange={setKind} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile label={kind === 'pickups' ? 'Jobs' : 'Records'} value={String(v.jobs)} />
          <StatTile label={kind === 'unloads' ? 'Delivered' : kind === 'transfers' ? 'Moved' : 'Collected'} value={fmtL(v.litres)} />
          <StatTile label="Drivers" value={String(v.drivers)} />
        </View>
      </AHeader>
      <FlatList data={v.sections} keyExtractor={(sec) => sec.title} contentContainerStyle={s.list}
        renderItem={({ item: sec }) => (
          <View>
            <DayHeader title={sec.title} right={sec.litres ? `${sec.data.length} · ${fmtL(sec.litres)}` : `${sec.data.length}`} />
            <ACard>{sec.data.map((it, i) => <View key={it.id}>{row(it, i === sec.data.length - 1)}</View>)}</ACard>
          </View>
        )}
        ListEmptyComponent={<Text style={s.empty}>{data ? `Nothing in the last ${range} days.` : 'Loading…'}</Text>}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} />} />
    </View>
  )
}

const s = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingBottom: 120 },
  sub: { fontSize: 11.5, color: c.faint },
  mono: { fontFamily: 'Menlo', color: c.primary },
  vol: { fontSize: 13, fontWeight: '600', color: c.text, fontFamily: 'Menlo' },
  meta: { fontSize: 11, color: c.ghost },
  empty: { fontSize: 13, color: c.faint, textAlign: 'center', paddingVertical: 32 },
})
