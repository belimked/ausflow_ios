import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, Segmented, Tag, type ATone } from '@/components/admin'
import * as api from '@/lib/api'
import { fmtDay, fmtTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'
import type { PublicUser, Ticket, TicketPriority } from '@/lib/types'

type Tab = 'open' | 'in_progress' | 'resolved' | 'mine'
const PRIO_TONE: Record<TicketPriority, ATone> = { critical: 'rose', normal: 'amber', low: 'slate' }
const DAY = 864e5
const when = (at?: string | null) => (!at ? '' : Date.now() - new Date(at).getTime() < DAY ? fmtTime(at) : fmtDay(at))

export default function Tickets() {
  const router = useRouter()
  const { session, online } = useStore()
  const [tickets, setTickets] = useState<Ticket[] | null>(null)
  const [users, setUsers] = useState<Map<string, PublicUser>>(new Map())
  const [mailbox, setMailbox] = useState<{ address?: string; lastPollAt?: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('open')

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const [t, u, m] = await Promise.all([api.listTickets(session.token), api.listUsers(session.token).catch(() => [] as PublicUser[]), api.mailboxStatus(session.token).catch(() => null)])
      setTickets(t); setUsers(new Map(u.map((x) => [x.id, x]))); setMailbox(m); setError(null)
    } catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [session])
  // Deferred so the first fetch happens after the screen has rendered.
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const me = session?.user.id
  const counts = useMemo(() => ({
    open: tickets?.filter((t) => t.status === 'open').length || 0,
    in_progress: tickets?.filter((t) => t.status === 'in_progress').length || 0,
    resolved: tickets?.filter((t) => t.status === 'resolved' || t.status === 'closed').length || 0,
    mine: tickets?.filter((t) => t.assigneeId === me && (t.status === 'open' || t.status === 'in_progress')).length || 0,
  }), [tickets, me])
  const rows = useMemo(() => (tickets || []).filter((t) => tab === 'mine' ? t.assigneeId === me && (t.status === 'open' || t.status === 'in_progress') : tab === 'resolved' ? (t.status === 'resolved' || t.status === 'closed') : t.status === tab), [tickets, tab, me])

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="MONITOR" title="Ops tickets" back={() => router.back()}>
        <Segmented options={[{ key: 'open', label: 'Open', count: counts.open }, { key: 'in_progress', label: 'In progress', count: counts.in_progress }, { key: 'resolved', label: 'Resolved', count: counts.resolved }, { key: 'mine', label: 'Mine', count: counts.mine }] as { key: Tab; label: string; count: number }[]} value={tab} onChange={setTab} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[s.dot, { backgroundColor: !online ? c.ghost : error ? c.danger : c.live }]} />
          <Text style={s.mail} numberOfLines={1}>{!online ? 'Offline · tickets need a connection' : error ? error : mailbox?.address ? `Mailbox ${mailbox.address}${mailbox.lastPollAt ? ` · polled ${fmtTime(mailbox.lastPollAt)}` : ''}` : 'Email tickets handled by the office'}</Text>
        </View>
      </AHeader>
      <FlatList data={rows} keyExtractor={(t) => t.id} contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={c.primary} />}
        renderItem={({ item: t, index }) => {
          const who = t.assigneeId ? users.get(t.assigneeId)?.displayName || t.assigneeId : null
          return (
            <ACard onPress={() => router.push(`/ticket/${t.id}`)} style={[s.card, index === 0 && s.first, index === rows.length - 1 && s.last]}>
              <View style={{ padding: 12, gap: 5 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Tag label={t.priority === 'critical' ? 'Urgent' : t.priority[0].toUpperCase() + t.priority.slice(1)} tone={PRIO_TONE[t.priority]} />
                  <Text style={s.subject} numberOfLines={1}>{t.subject}</Text>
                  <Text style={s.time}>{when(t.receivedAt || t.createdAt)}</Text>
                </View>
                <Text style={s.from} numberOfLines={1}>From {t.fromEmail || t.fromAddr || t.source || 'unknown'}{t.body ? ` · "${t.body.replace(/\s+/g, ' ').trim().slice(0, 80)}"` : ''}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Tag label={t.id} tone="slate" mono />
                  {t.attachmentCount ? <Tag label={`${t.attachmentCount} file${t.attachmentCount === 1 ? '' : 's'}`} tone="slate" /> : null}
                  <View style={{ flex: 1 }} />
                  {who ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={s.av}><Text style={s.avText}>{who.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</Text></View><Text style={s.who}>{who.split(' ')[0]}</Text></View> : <Tag label="Unassigned" tone="slate" />}
                </View>
              </View>
            </ACard>
          )
        }}
        ListEmptyComponent={<Text style={s.empty}>{tickets ? 'No tickets here.' : loading ? 'Loading…' : error || 'Loading…'}</Text>} />
    </View>
  )
}

const s = StyleSheet.create({
  dot: { width: 7, height: 7, borderRadius: 4 },
  mail: { fontSize: 12, color: c.faint, flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 60 },
  card: { borderRadius: 0, borderTopWidth: 0 },
  first: { borderTopWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  last: { borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  subject: { flex: 1, fontSize: 13.5, fontWeight: '600', color: c.text },
  time: { fontSize: 11, color: c.ghost, fontFamily: 'Menlo' },
  from: { fontSize: 11.5, color: c.faint },
  av: { width: 20, height: 20, borderRadius: 10, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  who: { fontSize: 11, color: c.muted },
  empty: { fontSize: 13, color: c.faint, textAlign: 'center', paddingVertical: 32 },
})
