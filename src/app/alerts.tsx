import { Stack, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { ACard, AHeader, Segmented, Tag, type ATone } from '@/components/admin'
import { ALERT_TYPES, alertCounts, alertViews, isActiveStatus, type AlertType, type AlertView, type Severity } from '@/lib/alerts'
import { fmtDay, fmtTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

type Sev = 'all' | Severity
const SEV_TONE: Record<Severity, ATone> = { critical: 'rose', warning: 'amber', info: 'blue' }
const DAY = 864e5
const when = (at: string | null) => (!at ? '' : Date.now() - new Date(at).getTime() < DAY ? fmtTime(at) : fmtDay(at))

export default function Alerts() {
  const router = useRouter()
  const { data, loading, refresh, canWrite, markAlertsRead } = useStore()
  const [sev, setSev] = useState<Sev>('all')
  const [type, setType] = useState<AlertType | null>(null)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [showClosed, setShowClosed] = useState(false)

  const all = useMemo(() => (data ? alertViews(data) : []), [data])
  const active = useMemo(() => all.filter((a) => isActiveStatus(a.status)), [all])
  const counts = useMemo(() => alertCounts(all), [all])
  const sevCount = useMemo(() => ({ critical: active.filter((a) => a.severity === 'critical').length, warning: active.filter((a) => a.severity === 'warning').length, info: active.filter((a) => a.severity === 'info').length }), [active])
  const typeCount = useMemo(() => { const m: Partial<Record<AlertType, number>> = {}; for (const a of active) m[a.type] = (m[a.type] || 0) + 1; return m }, [active])
  const rows = useMemo(() => (showClosed ? all : active).filter((a) => (sev === 'all' || a.severity === sev) && (!type || a.type === type) && (!unreadOnly || !a.read)), [all, active, showClosed, sev, type, unreadOnly])

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="MONITOR" title="Alerts" back={() => router.back()}
        right={<Text style={s.count}>{counts.active} open · <Text style={{ color: c.text, fontWeight: '600' }}>{counts.unread} unread</Text></Text>}>
        <Segmented options={[{ key: 'all', label: 'All', count: active.length }, { key: 'critical', label: 'Critical', count: sevCount.critical }, { key: 'warning', label: 'Warning', count: sevCount.warning }, { key: 'info', label: 'Info', count: sevCount.info }] as { key: Sev; label: string; count: number }[]} value={sev} onChange={setSev} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginHorizontal: -16, paddingHorizontal: 16 }}>
          <Chip label="All types" on={!type} onPress={() => setType(null)} />
          {(Object.keys(ALERT_TYPES) as AlertType[]).filter((t) => typeCount[t]).map((t) => <Chip key={t} label={`${ALERT_TYPES[t]} ${typeCount[t]}`} on={type === t} onPress={() => setType(type === t ? null : t)} />)}
        </ScrollView>
      </AHeader>
      <View style={s.tools}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={s.tool}>Unread only</Text><Switch value={unreadOnly} onValueChange={setUnreadOnly} trackColor={{ true: c.primary }} style={{ transform: [{ scale: 0.8 }] }} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={s.tool}>Closed too</Text><Switch value={showClosed} onValueChange={setShowClosed} trackColor={{ true: c.primary }} style={{ transform: [{ scale: 0.8 }] }} /></View>
        <View style={{ flex: 1 }} />
        {canWrite && counts.unread ? <Pressable onPress={() => markAlertsRead(active.filter((a) => !a.read).map((a) => a.id))} style={s.btn}><Text style={s.btnText}>Mark all read</Text></Pressable> : null}
      </View>
      <FlatList data={rows} keyExtractor={(a) => a.id} contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} />}
        renderItem={({ item: a, index }) => <AlertRow a={a} first={index === 0} last={index === rows.length - 1} onPress={() => router.push(`/alert/${a.id}`)} />}
        ListEmptyComponent={<Text style={s.empty}>{data ? 'No alerts match.' : 'Loading…'}</Text>} />
    </View>
  )
}

export function AlertRow({ a, first, last, onPress }: { a: AlertView; first?: boolean; last?: boolean; onPress: () => void }) {
  return (
    <ACard onPress={onPress} style={[s.rowCard, first && s.first, last && s.last]}>
      <View style={{ flexDirection: 'row', gap: 12, padding: 12, paddingLeft: 16 }}>
        {!a.read && isActiveStatus(a.status) ? <View style={s.dot} /> : null}
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[s.title, a.read && { fontWeight: '500' }]} numberOfLines={2}>{a.title}</Text>
          <Text style={s.detail} numberOfLines={2}>{a.detail}</Text>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            <Tag label={a.severity[0].toUpperCase() + a.severity.slice(1)} tone={SEV_TONE[a.severity]} />
            <Tag label={ALERT_TYPES[a.type]} tone="slate" />
            {a.status !== 'new' ? <Tag label={a.status[0].toUpperCase() + a.status.slice(1)} tone={isActiveStatus(a.status) ? 'blue' : 'slate'} /> : null}
          </View>
        </View>
        <Text style={s.time}>{when(a.at)}</Text>
      </View>
    </ACard>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[s.chip, on && { backgroundColor: c.primary, borderColor: c.primary }]}><Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text></Pressable>
}

const s = StyleSheet.create({
  count: { fontSize: 12, color: c.faint },
  chip: { height: 28, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, justifyContent: 'center' },
  chipText: { fontSize: 12, fontWeight: '500', color: c.muted },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 6 },
  tool: { fontSize: 12, color: c.faint },
  btn: { height: 28, paddingHorizontal: 10, borderRadius: 7, backgroundColor: c.field, justifyContent: 'center' },
  btnText: { fontSize: 12, fontWeight: '500', color: c.primary },
  list: { paddingHorizontal: 16, paddingBottom: 60 },
  rowCard: { borderRadius: 0, borderTopWidth: 0 },
  first: { borderTopWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  last: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  dot: { position: 'absolute', left: 5, top: 18, width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
  title: { fontSize: 13.5, fontWeight: '600', color: c.text, lineHeight: 18 },
  detail: { fontSize: 11.5, color: c.faint, lineHeight: 16 },
  time: { fontSize: 11, color: c.ghost, fontFamily: 'Menlo' },
  empty: { fontSize: 13, color: c.faint, textAlign: 'center', paddingVertical: 32 },
})
