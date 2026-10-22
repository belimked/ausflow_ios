import { useMemo, useState } from 'react'
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native'
import { JobRow } from '@/components/items'
import { Chip, EmptyState, Row, ScreenHeader } from '@/components/ui'
import { fmtDay, fmtL, fmtTime } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius, shadow } from '@/lib/theme'
import type { Pickup, Transfer, Unload } from '@/lib/types'

type Scope = 'mine' | 'company' | 'all'
type Kind = 'pickups' | 'offloads' | 'transfers'
type Item = { id: string; at: string; volume: number } & (
  | { kind: 'pickup'; ref: Pickup }
  | { kind: 'unload'; ref: Unload }
  | { kind: 'transfer'; ref: Transfer }
)

const EMPTY: Record<Kind, string> = { pickups: 'No pickups yet', offloads: 'No offloads yet', transfers: 'No transfers yet' }

export default function Jobs() {
  const { data, profile, loading, refresh } = useStore()
  const ix = useIndex()
  const [scope, setScope] = useState<Scope>(profile ? 'mine' : 'all')
  const [kind, setKind] = useState<Kind>('pickups')

  const sections = useMemo(() => {
    const inScope = (r: { driverId?: string | null; companyId?: string | null }) =>
      scope === 'all' || !profile ? true : scope === 'mine' ? r.driverId === profile.driverId : r.companyId === profile.companyId
    const out: { title: string; total?: number; data: Item[] }[] = []
    let done: Item[]
    if (kind === 'pickups') {
      const rows = (data?.pickups || []).filter(inScope)
      const ongoing = rows.filter((p) => p.status === 'ongoing')
      if (ongoing.length) out.push({ title: 'In progress', data: ongoing.map((p) => ({ kind: 'pickup', id: p.id, at: p.startAt || '', volume: 0, ref: p })) })
      done = rows.filter((p) => p.status === 'done').map((p) => ({ kind: 'pickup', id: p.id, at: p.endAt || '', volume: p.volume || 0, ref: p }))
    } else if (kind === 'offloads') {
      done = (data?.unloads || []).filter(inScope).map((u) => ({ kind: 'unload', id: u.id, at: u.at, volume: u.volume || 0, ref: u }))
    } else {
      done = (data?.transfers || []).filter(inScope).map((t) => ({ kind: 'transfer', id: t.id, at: t.at, volume: t.volume || 0, ref: t }))
    }
    done = done.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 150)
    const groups = new Map<string, Item[]>()
    for (const it of done) {
      const k = fmtDay(it.at)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(it)
    }
    for (const [title, list] of groups) out.push({ title, total: list.reduce((n, it) => n + it.volume, 0), data: list })
    return out
  }, [data, profile, scope, kind])

  const plate = (id?: string | null) => (id && ix.vehicles.get(id)?.plate) || '—'
  const who = (id?: string | null) => (scope !== 'mine' && id ? ix.drivers.get(id)?.name : null)

  function render(it: Item) {
    if (it.kind === 'pickup') return <JobRow pickup={it.ref} showDriver={scope !== 'mine'} />
    if (it.kind === 'unload') {
      const u = it.ref
      return <Row icon="building.columns.fill" tone="success" title={`${fmtL(u.volume)} · ${ix.facilities.get(u.facilityId || '')?.name || 'Facility'}`}
        subtitle={[plate(u.vehicleId), fmtTime(u.at), who(u.driverId)].filter(Boolean).join(' · ')} />
    }
    const t = it.ref
    return <Row icon="arrow.left.arrow.right" tone="neutral" title={`${fmtL(t.volume)} · ${plate(t.fromVehicleId)} → ${plate(t.toVehicleId)}`}
      subtitle={[fmtTime(t.at), who(t.driverId)].filter(Boolean).join(' · ')} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="History" />
      <View style={s.chips}>
        <Chip label="Pickups" icon="drop.fill" active={kind === 'pickups'} onPress={() => setKind('pickups')} />
        <Chip label="Offloads" icon="building.columns.fill" active={kind === 'offloads'} onPress={() => setKind('offloads')} />
        <Chip label="Transfers" icon="arrow.left.arrow.right" active={kind === 'transfers'} onPress={() => setKind('transfers')} />
      </View>
      <View style={[s.chips, { paddingTop: 8 }]}>
        {profile ? <Chip label="Mine" icon="person.fill" active={scope === 'mine'} onPress={() => setScope('mine')} /> : null}
        {profile ? <Chip label="My company" icon="building.2.fill" active={scope === 'company'} onPress={() => setScope('company')} /> : null}
        <Chip label="All" active={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(it) => it.id}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        renderSectionHeader={({ section }) => (
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            {section.total != null ? <Text style={s.sectionMeta}>{section.data.length} · {fmtL(section.total)}</Text> : null}
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={[s.item, index === 0 && s.first, index === section.data.length - 1 && s.last]}>
            {index > 0 && <View style={s.sep} />}
            {render(item)}
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="tray" title={EMPTY[kind]} message={scope === 'mine' ? 'What you record will appear here.' : 'Nothing has been recorded.'} />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionMeta: { fontSize: 13, fontWeight: '600', color: colors.faint },
  item: { backgroundColor: colors.card, ...shadow, shadowOpacity: 0, overflow: 'hidden' },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
})
