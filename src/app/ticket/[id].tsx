import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActionSheetIOS, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ACard, AHeader, KV, SectionCard, Tag, type ATone } from '@/components/admin'
import * as api from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import { useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'
import type { PublicUser, Ticket, TicketNote, TicketPriority, TicketStatus } from '@/lib/types'

const PRIO_TONE: Record<TicketPriority, ATone> = { critical: 'rose', normal: 'amber', low: 'slate' }
const STATUS: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']
const STATUS_LABEL: Record<TicketStatus, string> = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' }
const PRIO: TicketPriority[] = ['critical', 'normal', 'low']

export default function TicketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session, canWrite } = useStore()
  const [t, setT] = useState<Ticket | null>(null)
  const [notes, setNotes] = useState<TicketNote[]>([])
  const [users, setUsers] = useState<PublicUser[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    try {
      const [tk, ns, us] = await Promise.all([api.getTicket(session.token, id), api.ticketNotes(session.token, id), api.listUsers(session.token).catch(() => [] as PublicUser[])])
      setT(tk); setNotes(ns); setUsers(us.filter((u) => u.status !== 'disabled')); setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [session, id])
  // Deferred so the first fetch happens after the screen has rendered.
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  async function patch(body: Parameters<typeof api.patchTicket>[2]) {
    if (!session) return
    try { setBusy(true); await api.patchTicket(session.token, id, body); await load() } catch (e) { Alert.alert('Could not update', (e as Error).message) } finally { setBusy(false) }
  }
  const sheet = <T extends string>(title: string, options: T[], label: (o: T) => string, pick: (o: T) => void) =>
    ActionSheetIOS.showActionSheetWithOptions({ title, options: [...options.map(label), 'Cancel'], cancelButtonIndex: options.length }, (i) => { if (i < options.length) pick(options[i]) })

  const assignee = t?.assigneeId ? users.find((u) => u.id === t.assigneeId) : undefined
  const assignable = users.filter((u) => u.role === 'ops' || u.role === 'admin' || u.role === 'authority')

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow={`TICKET · ${id}`} title={t?.subject || 'Ticket'} back={() => router.back()}>
        {t ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            <Tag label={t.priority === 'critical' ? 'Urgent' : t.priority[0].toUpperCase() + t.priority.slice(1)} tone={PRIO_TONE[t.priority]} />
            <Tag label={STATUS_LABEL[t.status]} tone={t.status === 'open' ? 'amber' : t.status === 'in_progress' ? 'blue' : 'green'} />
            {t.receivedAt ? <Tag label={fmtDateTime(t.receivedAt)} tone="slate" /> : null}
          </View>
        ) : null}
      </AHeader>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {error ? <Text style={s.empty}>{error}</Text> : null}
        {t ? (
          <>
            <ACard>
              <View style={{ flexDirection: 'row' }}>
                <KV label="From" value={<Text style={s.link} onPress={t.fromEmail ? () => Linking.openURL(`mailto:${t.fromEmail}?subject=Re: ${encodeURIComponent(t.subject)}`) : undefined} numberOfLines={2}>{t.fromAddr || t.fromEmail || t.source || '—'}</Text>} />
                <KV label="Assignee" right value={
                  <Pressable disabled={!canWrite} onPress={() => sheet('Assign to', [...assignable.map((u) => u.id), ''], (uid) => (uid ? assignable.find((u) => u.id === uid)!.displayName : 'Unassigned'), (uid) => patch({ assigneeId: uid || null }))}>
                    <Text style={[s.value, canWrite && s.link]}>{assignee?.displayName || (t.assigneeId ? t.assigneeId : 'Unassigned')}{canWrite ? ' ›' : ''}</Text>
                  </Pressable>} />
              </View>
              <View style={{ flexDirection: 'row' }}>
                <KV label="Status" last value={
                  <Pressable disabled={!canWrite} onPress={() => sheet('Set status', STATUS, (x) => STATUS_LABEL[x], (x) => patch({ status: x }))}>
                    <Text style={[s.value, canWrite && s.link]}>{STATUS_LABEL[t.status]}{canWrite ? ' ›' : ''}</Text>
                  </Pressable>} />
                <KV label="Priority" right last value={
                  <Pressable disabled={!canWrite} onPress={() => sheet('Set priority', PRIO, (x) => x[0].toUpperCase() + x.slice(1), (x) => patch({ priority: x }))}>
                    <Text style={[s.value, canWrite && s.link]}>{t.priority[0].toUpperCase() + t.priority.slice(1)}{t.confidence != null ? ` · ${Math.round(t.confidence * 100)}%` : ''}{canWrite ? ' ›' : ''}</Text>
                  </Pressable>} />
              </View>
            </ACard>

            <SectionCard title="Message" sub={t.classifiedBy ? `Priority by ${t.classifiedBy}` : undefined}>
              <View style={{ paddingHorizontal: 14, paddingBottom: 14 }}>
                <Text style={s.bodyText} selectable>{(t.body || '').trim() || '(no text body)'}</Text>
                {t.attachments?.length ? (
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {t.attachments.map((a) => <Tag key={a.id} label={a.filename || a.mimeType || 'attachment'} tone="slate" />)}
                  </View>
                ) : null}
              </View>
            </SectionCard>

            {canWrite && t.status !== 'closed' ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {t.status === 'open' ? <Btn label="Start working" primary onPress={() => patch({ status: 'in_progress' })} disabled={busy} /> : null}
                {t.status !== 'resolved' ? <Btn label="Resolve" primary={t.status !== 'open'} onPress={() => patch({ status: 'resolved' })} disabled={busy} /> : <Btn label="Close" onPress={() => patch({ status: 'closed' })} disabled={busy} />}
                {t.status === 'resolved' ? <Btn label="Reopen" onPress={() => patch({ status: 'open' })} disabled={busy} /> : null}
              </View>
            ) : null}

            <SectionCard title="Notes & history" sub={`${notes.length} entr${notes.length === 1 ? 'y' : 'ies'}`}>
              {canWrite ? (
                <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10 }}>
                  <TextInput value={note} onChangeText={setNote} placeholder="Add a note" placeholderTextColor={c.ghost} style={s.input} multiline />
                  <Btn label="Add" primary onPress={async () => { await patch({ note }); setNote('') }} disabled={busy || !note.trim()} />
                </View>
              ) : null}
              {notes.map((n, i) => (
                <View key={n.id} style={{ flexDirection: 'row' }}>
                  <KV label={`${n.user || 'System'} · ${fmtDateTime(n.at)}`} last={i === notes.length - 1} right value={<Text style={[s.note, n.kind !== 'note' && { color: c.faint }]}>{n.text}</Text>} />
                </View>
              ))}
            </SectionCard>
          </>
        ) : !error ? <Text style={s.empty}>Loading…</Text> : null}
      </ScrollView>
    </View>
  )
}

function Btn({ label, onPress, primary, disabled }: { label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return <Text onPress={disabled ? undefined : onPress} style={[s.btn, primary && s.btnPrimary, disabled && { opacity: 0.5 }]}>{label}</Text>
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 80 },
  value: { fontSize: 13.5, color: c.text, fontWeight: '600' },
  link: { color: c.primary },
  bodyText: { fontSize: 13.5, lineHeight: 20, color: c.body },
  btn: { flex: 1, height: 40, lineHeight: 40, textAlign: 'center', borderRadius: 9, backgroundColor: c.field, color: c.primary, fontSize: 13, fontWeight: '600', overflow: 'hidden' },
  btnPrimary: { backgroundColor: c.primary, color: '#fff' },
  input: { flex: 1, minHeight: 38, maxHeight: 100, borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: c.text },
  note: { fontSize: 13, color: c.text, lineHeight: 18 },
  empty: { fontSize: 13, color: c.faint, padding: 24, textAlign: 'center' },
})
