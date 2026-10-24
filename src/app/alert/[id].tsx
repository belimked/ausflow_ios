import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert as RNAlert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { ACard, AHeader, ARow, KV, SectionCard, Tag, type ATone } from '@/components/admin'
import { ALERT_TYPES, STATUS_LABEL, alertViews, isActiveStatus, notesOf, type Severity } from '@/lib/alerts'
import { fmtDateTime } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'
import type { AlertStatus } from '@/lib/types'

const SEV_TONE: Record<Severity, ATone> = { critical: 'rose', warning: 'amber', info: 'blue' }

export default function AlertScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data, canWrite, setAlertStatus, addAlertNote, markAlertsRead } = useStore()
  const ix = useIndex()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const a = useMemo(() => (data ? alertViews(data).find((x) => x.id === id) : undefined), [data, id])
  const notes = useMemo(() => (data ? notesOf(data, id) : []), [data, id])

  useEffect(() => { if (a && !a.read && canWrite) markAlertsRead([a.id]).catch(() => {}) }, [a?.id, a?.read, canWrite]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!a) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Alert" back={() => router.back()} /><Text style={s.empty}>This alert is no longer raised (the condition cleared or the data changed).</Text></View>

  async function change(status: AlertStatus) {
    if (!a) return
    const needReason = status === 'cleared' || status === 'dismissed'
    const go = async (reason?: string) => {
      try { setBusy(true); await setAlertStatus(a.id, status, reason || '') } catch (e) { RNAlert.alert('Could not update', (e as Error).message) } finally { setBusy(false) }
    }
    if (!needReason) return go()
    RNAlert.prompt(status === 'cleared' ? 'Clear this alert' : 'Dismiss this alert', 'A reason is required and is kept with the alert.', [
      { text: 'Cancel', style: 'cancel' }, { text: status === 'cleared' ? 'Clear' : 'Dismiss', onPress: (r?: string) => { if (r?.trim()) go(r) } },
    ], 'plain-text')
  }
  async function sendNote() {
    if (!a || !note.trim()) return
    try { setBusy(true); await addAlertNote(a.id, note); setNote('') } catch (e) { RNAlert.alert('Could not save the note', (e as Error).message) } finally { setBusy(false) }
  }
  const r = a.refs
  const links = [
    r.deviceId && ix.devices.get(r.deviceId) ? { icon: 'drop.fill' as const, title: ix.devices.get(r.deviceId)!.ref, sub: 'Device', to: `/device/${r.deviceId}` } : null,
    r.pickupId && ix.pickups.get(r.pickupId) ? { icon: 'checkmark.circle.fill' as const, title: `Pickup ${r.pickupId}`, sub: 'Record', to: `/job/${r.pickupId}` } : null,
    r.locationId && ix.locations.get(r.locationId) ? { icon: 'mappin.and.ellipse' as const, title: ix.locations.get(r.locationId)!.name, sub: 'Location', to: `/location/${r.locationId}` } : null,
    r.companyId && ix.companies.get(r.companyId) ? { icon: 'building.2.fill' as const, title: ix.companies.get(r.companyId)!.name, sub: 'Transport company', to: `/company/${r.companyId}` } : null,
    r.driverId && ix.drivers.get(r.driverId) ? { icon: 'person.fill' as const, title: ix.drivers.get(r.driverId)!.name, sub: 'Driver', to: `/driver/${r.driverId}` } : null,
    r.vehicleId && ix.vehicles.get(r.vehicleId) ? { icon: 'truck.box.fill' as const, title: ix.vehicles.get(r.vehicleId)!.plate, sub: 'Vehicle', to: `/vehicle/${r.vehicleId}` } : null,
  ].filter(Boolean) as { icon: 'drop.fill'; title: string; sub: string; to: string }[]
  const active = isActiveStatus(a.status)

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow={`ALERT · ${a.id}`} title={ALERT_TYPES[a.type]} back={() => router.back()}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Tag label={a.severity[0].toUpperCase() + a.severity.slice(1)} tone={SEV_TONE[a.severity]} />
          <Tag label={STATUS_LABEL[a.status]} tone={a.status === 'new' ? 'rose' : active ? 'blue' : 'slate'} />
          {a.at ? <Tag label={fmtDateTime(a.at)} tone="slate" /> : null}
        </View>
      </AHeader>
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <ACard style={{ padding: 14, gap: 6 }}>
          <Text style={s.title}>{a.title}</Text>
          <Text style={s.detail}>{a.detail}</Text>
        </ACard>
        {links.length ? (
          <SectionCard title="Related">
            {links.map((l, i) => <ARow key={l.to} icon={l.icon} title={l.title} subtitle={l.sub} last={i === links.length - 1} onPress={() => router.push(l.to as any)} />)}
          </SectionCard>
        ) : null}
        {canWrite ? (
          <SectionCard title="Follow-up" sub={active ? 'Acknowledge while you look into it; clear when fixed; dismiss if it is not a problem' : 'Reopen if the problem is back'}>
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 14, flexWrap: 'wrap' }}>
              {a.status === 'new' ? <Btn label="Acknowledge" primary onPress={() => change('acknowledged')} disabled={busy} /> : null}
              {active ? <Btn label="Clear" onPress={() => change('cleared')} disabled={busy} /> : null}
              {active ? <Btn label="Dismiss" onPress={() => change('dismissed')} disabled={busy} danger /> : null}
              {!active ? <Btn label="Reopen" primary onPress={() => change('new')} disabled={busy} /> : null}
            </View>
          </SectionCard>
        ) : null}
        <SectionCard title="Notes" sub={notes.length ? `${notes.length} entr${notes.length === 1 ? 'y' : 'ies'}` : 'No notes yet'}>
          {canWrite ? (
            <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10 }}>
              <TextInput value={note} onChangeText={setNote} placeholder="Add a note" placeholderTextColor={c.ghost} style={s.input} multiline />
              <Btn label="Add" primary onPress={sendNote} disabled={busy || !note.trim()} />
            </View>
          ) : null}
          {notes.map((n, i) => (
            <View key={n.id} style={{ flexDirection: 'row' }}>
              <KV label={`${n.user || 'Console'} · ${fmtDateTime(n.at)}`} last={i === notes.length - 1} right value={n.kind === 'status' ? <Text style={s.status}>Status → {STATUS_LABEL[(n.status || 'new') as AlertStatus] || n.status}</Text> : <Text style={s.note}>{n.text}</Text>} />
            </View>
          ))}
        </SectionCard>
      </ScrollView>
    </View>
  )
}

function Btn({ label, onPress, primary, danger, disabled }: { label: string; onPress: () => void; primary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Text onPress={disabled ? undefined : onPress} style={[s.btn, primary && s.btnPrimary, danger && s.btnDanger, disabled && { opacity: 0.5 }]}>{label}</Text>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 80 },
  title: { fontSize: 15, fontWeight: '700', color: c.text, lineHeight: 20 },
  detail: { fontSize: 13, color: c.muted, lineHeight: 18 },
  btn: { height: 38, lineHeight: 38, paddingHorizontal: 14, borderRadius: 9, backgroundColor: c.field, color: c.primary, fontSize: 13, fontWeight: '600', overflow: 'hidden' },
  btnPrimary: { backgroundColor: c.primary, color: '#fff' },
  btnDanger: { backgroundColor: c.dangerSoft, color: c.dangerText },
  input: { flex: 1, minHeight: 38, maxHeight: 100, borderRadius: 9, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: c.text },
  status: { fontSize: 13, color: c.primaryDark, fontWeight: '600' },
  note: { fontSize: 13, color: c.text, lineHeight: 18 },
  empty: { fontSize: 13, color: c.faint, padding: 24, textAlign: 'center' },
})
