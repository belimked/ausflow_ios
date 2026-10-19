import { useMemo, useState } from 'react'
import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native'
import { JobRow } from '@/components/items'
import { Chip, EmptyState, ScreenHeader } from '@/components/ui'
import { fmtDay, fmtL } from '@/lib/format'
import { useStore } from '@/lib/store'
import { colors, radius, shadow } from '@/lib/theme'
import type { Pickup } from '@/lib/types'

type Scope = 'mine' | 'company' | 'all'

export default function Jobs() {
  const { data, profile, loading, refresh } = useStore()
  const [scope, setScope] = useState<Scope>(profile ? 'mine' : 'all')

  const sections = useMemo(() => {
    const rows = (data?.pickups || []).filter((p) =>
      scope === 'all' || !profile ? true : scope === 'mine' ? p.driverId === profile.driverId : p.companyId === profile.companyId)
    const ongoing = rows.filter((p) => p.status === 'ongoing')
    const done = rows.filter((p) => p.status === 'done').sort((a, b) => (b.endAt || '').localeCompare(a.endAt || '')).slice(0, 150)
    const groups = new Map<string, Pickup[]>()
    for (const p of done) {
      const k = fmtDay(p.endAt)
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(p)
    }
    const out: { title: string; total?: number; data: Pickup[] }[] = []
    if (ongoing.length) out.push({ title: 'In progress', data: ongoing })
    for (const [title, list] of groups) out.push({ title, total: list.reduce((n, p) => n + (p.volume || 0), 0), data: list })
    return out
  }, [data, profile, scope])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScreenHeader title="Pickups" />
      <View style={s.chips}>
        {profile ? <Chip label="Mine" icon="person.fill" active={scope === 'mine'} onPress={() => setScope('mine')} /> : null}
        {profile ? <Chip label="My company" icon="building.2.fill" active={scope === 'company'} onPress={() => setScope('company')} /> : null}
        <Chip label="All" active={scope === 'all'} onPress={() => setScope('all')} />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(p) => p.id}
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
            <JobRow pickup={item} showDriver={scope !== 'mine'} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="tray" title="No pickups yet" message={scope === 'mine' ? 'Pickups you record will appear here.' : 'No pickups have been recorded.'} />}
      />
    </View>
  )
}

const s = StyleSheet.create({
  chips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionMeta: { fontSize: 13, fontWeight: '600', color: colors.faint },
  item: { backgroundColor: colors.card, ...shadow, shadowOpacity: 0 },
  first: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  last: { borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 },
})
