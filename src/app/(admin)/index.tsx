import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, Bars, IconButton, Kpi, LinkText, RankRow, SectionCard, StatusStrip, Tag } from '@/components/admin'
import { JobRow } from '@/components/items'
import { dashboardSummary, overdueByCompany, pickupsPerDay } from '@/lib/admin'
import { alertCounts, alertViews, isActiveStatus } from '@/lib/alerts'
import { AlertRow } from '../alerts'
import { fmtL, fmtTime } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

const DAYS = 14
const dayLabel = (t: number, i: number) => (i % 3 === 0 ? new Date(t).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) : null)
const dayFull = (t: number) => new Date(t).toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' })

export default function Dashboard() {
  const router = useRouter()
  const { data, session, loading, refresh, loadedAt, online, syncing } = useStore()
  const ix = useIndex()

  const v = useMemo(() => {
    if (!data) return null
    const sum = dashboardSummary(data)
    const days = pickupsPerDay(data.pickups, DAYS)
    const rank = overdueByCompany(data)
    const recent = data.pickups
      .filter((p) => p.status === 'done' && p.flags?.length)
      .sort((a, b) => (b.endAt || '').localeCompare(a.endAt || ''))
      .slice(0, 3)
    const ongoing = data.pickups.filter((p) => p.status === 'ongoing').sort((a, b) => (b.startAt || '').localeCompare(a.startAt || ''))
    const alerts = alertViews(data)
    const top = alerts.filter((a) => isActiveStatus(a.status)).slice(0, 3)
    return { sum, days, rank, recent, ongoing, alerts: alertCounts(alerts), top }
  }, [data])

  const first = (session?.user.displayName || '').split(' ')[0]
  const today = new Date().toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()
  const b = v?.sum.buckets

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AHeader eyebrow="OPS CONSOLE" title="AusFlow" right={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View>
            <IconButton name="bell.fill" label={`Alerts, ${v?.alerts.unread ?? 0} unread`} onPress={() => router.push('/alerts')} testID="dash-alerts" />
            {v?.alerts.unread ? <View style={s.badge}><Text style={s.badgeText}>{v.alerts.unread > 99 ? '99+' : v.alerts.unread}</Text></View> : null}
          </View>
          <IconButton name="qrcode.viewfinder" label="Scan" onPress={() => router.push('/scan')} />
        </View>}>
        <StatusStrip
          items={[
            { label: 'Overdue', value: b?.overdue ?? '–', color: b?.overdue ? c.warning : c.live, onPress: () => router.navigate({ pathname: '/devices', params: { filter: 'overdue' } }) },
            { label: 'Critical', value: v?.alerts.critical ?? '–', color: v?.alerts.critical ? c.danger : c.live, onPress: () => router.push('/alerts') },
            { label: !online ? 'Offline' : syncing ? 'Syncing' : 'Live', color: online ? c.live : c.ghost },
          ]}
          right={loadedAt ? fmtTime(new Date(loadedAt).toISOString()) : undefined}
        />
      </AHeader>
      <ScrollView contentContainerStyle={s.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={c.primary} />}>
        <View style={{ gap: 4, paddingHorizontal: 2 }}>
          <Text style={s.eyebrow}>OPERATIONS OVERVIEW · {today}</Text>
          <Text style={s.h2} testID="dash-welcome">Welcome back{first ? `, ${first}` : ''}</Text>
          {v ? (
            <Text style={s.p}>
              {b!.active} active devices across {v.sum.locations} locations. {b!.overdue} overdue for service, {v.sum.ongoing} pickup{v.sum.ongoing === 1 ? '' : 's'} in progress, {v.sum.p7} completed in the last 7 days.
            </Text>
          ) : <Text style={s.p}>Loading the latest data…</Text>}
        </View>

        <View style={s.grid}>
          <Kpi testID="dash-kpi-active" label="Active devices" value={String(b?.active ?? '–')} icon="drop.fill"
            badge={b ? `${v!.sum.compliance}%` : undefined} badgeTone={b && v!.sum.compliance < 95 ? 'amber' : 'green'}
            segments={b ? [{ value: b.ok + b.none, color: c.success }, { value: b.soon, color: c.warning }, { value: b.overdue, color: c.danger }] : undefined}
            onPress={() => router.navigate('/devices')} />
          <Kpi testID="dash-kpi-overdue" label="Overdue" value={String(b?.overdue ?? '–')} icon="clock.badge.exclamationmark" iconColor={c.warning}
            badge={b?.soon ? `${b.soon} due soon` : undefined} badgeTone="amber"
            note={v?.rank[0] ? `Worst ${Math.floor(v.rank[0].worstDays / 7)} wk · ${ix.companies.get(v.rank[0].companyId)?.name || 'No company'}` : 'Nothing overdue'}
            onPress={() => router.navigate({ pathname: '/devices', params: { filter: 'overdue' } })} />
          <Kpi testID="dash-kpi-p7" label="Pump-outs · 7d" value={String(v?.sum.p7 ?? '–')} icon="arrow.down.to.line" iconColor={c.success}
            badge={v?.sum.trend != null ? `${v.sum.trend >= 0 ? '+' : ''}${v.sum.trend}%` : undefined} badgeTone={v && v.sum.trend != null && v.sum.trend < 0 ? 'amber' : 'green'}
            note={v ? `${fmtL(v.sum.litres7)} collected` : undefined} onPress={() => router.navigate('/records')} />
          <Kpi testID="dash-kpi-alerts" label="Open alerts" value={String(v?.alerts.active ?? '–')} icon="bell.fill" iconColor={c.danger}
            badge={v?.alerts.critical ? `${v.alerts.critical} critical` : undefined} badgeTone="rose" note={v ? `${v.alerts.unread} unread · ${v.sum.openIssues} reported issue${v.sum.openIssues === 1 ? '' : 's'}` : undefined} onPress={() => router.push('/alerts')} />
        </View>

        <SectionCard title="Pump-outs" sub={`Completed per day · last ${DAYS} days · touch a bar for details`}>
          <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            <Bars rows={v?.days.map((d) => d.count) || []} labels={v?.days.map((d, i) => dayLabel(d.day, i))}
              tooltip={(i) => { const d = v!.days[i]; return `${dayFull(d.day)} · ${d.count} pump-out${d.count === 1 ? '' : 's'} · ${fmtL(d.litres)}` }} />
          </View>
        </SectionCard>

        <SectionCard title="Overdue by transport company" sub="Worst first · tap to filter devices"
          right={<LinkText label="All overdue" onPress={() => router.navigate({ pathname: '/devices', params: { filter: 'overdue' } })} />}>
          <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
            {v?.rank.length ? v.rank.slice(0, 5).map((r, i) => (
              <RankRow key={r.companyId || 'none'} rank={i + 1} label={ix.companies.get(r.companyId)?.name || 'No transport company'} value={String(r.total)}
                ratio={r.total / v.rank[0].total} color={i === 0 ? c.danger : c.warning}
                onPress={r.companyId ? () => router.navigate({ pathname: '/devices', params: { filter: 'overdue', company: r.companyId } }) : undefined} />
            )) : <Text style={s.empty}>No overdue devices.</Text>}
          </View>
        </SectionCard>

        {v?.ongoing.length ? (
          <SectionCard title="In progress now" sub={`${v.ongoing.length} pickup${v.ongoing.length === 1 ? '' : 's'} started`}>
            {v.ongoing.slice(0, 3).map((p) => <JobRow key={p.id} pickup={p} showDriver />)}
          </SectionCard>
        ) : null}

        <SectionCard title="Alerts" sub={v ? `${v.alerts.active} open · ${v.alerts.unread} unread` : undefined} right={<LinkText label="View all" onPress={() => router.push('/alerts')} />}>
          {v?.top.length ? v.top.map((a, i) => <AlertRow key={a.id} a={a} onPress={() => router.push(`/alert/${a.id}`)} first={false} last={i === v.top.length - 1} />) : (
            <View style={{ padding: 14, paddingTop: 4 }}><Tag label="No open alerts" tone="green" /></View>
          )}
        </SectionCard>

        <SectionCard title="Recently flagged" sub="Pickups with a location or capacity flag" right={<LinkText label="Records" onPress={() => router.navigate('/records')} />}>
          {v?.recent.length ? v.recent.map((p) => <JobRow key={p.id} pickup={p} showDriver />) : (
            <View style={{ padding: 14, paddingTop: 4 }}><Tag label="No flags in the last 14 days" tone="green" /></View>
          )}
        </SectionCard>
        <ACard style={{ padding: 12 }}>
          <Text style={{ fontSize: 11, color: c.faint }}>Figures come from the data on this phone (same rules as the web console). Pull down to refresh.</Text>
        </ACard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 120 },
  eyebrow: { fontSize: 10, letterSpacing: 0.8, color: c.primary, fontWeight: '600', fontFamily: 'Menlo' },
  h2: { fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.2 },
  p: { fontSize: 13, lineHeight: 19, color: c.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  empty: { fontSize: 13, color: c.faint, paddingVertical: 6 },
  badge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: c.danger, borderWidth: 2, borderColor: c.card, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
})
