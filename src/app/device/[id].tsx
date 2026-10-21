import * as Haptics from 'expo-haptics'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useState } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DueBadge, JobRow } from '@/components/items'
import { Button, Card, Divider, EmptyState, Icon, IconBadge, Pill, Row, SectionTitle, toneColor } from '@/components/ui'
import { addressOf, deviceTitle, dueState, fmtDate, fmtL, fmtM, nextService } from '@/lib/format'
import { currentCoords, distanceM, quietCoords } from '@/lib/geo'
import { issueLabel, openIssues } from '@/lib/issues'
import { useIndex, useStore } from '@/lib/store'
import { colors, radius } from '@/lib/theme'
import type { Coords } from '@/lib/types'

export default function DeviceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, profile, canWrite, startJob, serviceOnly } = useStore()
  const ix = useIndex()
  const [here, setHere] = useState<Coords | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => { quietCoords().then(setHere) }, [])

  const dev = ix.devices.get(id)
  const loc = dev?.locationId ? ix.locations.get(dev.locationId) : undefined
  const company = dev?.companyId ? ix.companies.get(dev.companyId) : undefined
  const history = useMemo(() => (data?.pickups || []).filter((p) => p.deviceId === id && p.status === 'done')
    .sort((a, b) => (b.endAt || '').localeCompare(a.endAt || '')).slice(0, 5), [data, id])

  const issues = useMemo(() => openIssues(data?.reportedIssues || [], id), [data, id])

  if (!dev) return <EmptyState icon="questionmark.circle" title="Device not found" message="It may have been removed in the web console." />

  const due = dueState(dev)
  const ongoing = ix.ongoingByDevice.get(dev.id)
  const myOngoing = profile ? data?.pickups.find((p) => p.status === 'ongoing' && p.driverId === profile.driverId) : undefined
  const away = distanceM(here?.lat, here?.lng, dev.lat, dev.lng)
  const banner = { overdue: 'danger', soon: 'warning', ok: 'success', unknown: 'neutral' } as const

  async function start() {
    if (!dev) return
    if (dev.status !== 'Active') {
      const ok = await new Promise<boolean>((resolve) => Alert.alert('Device is not active', `This device is marked ${dev.status}. Start a pickup anyway?`, [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Start', onPress: () => resolve(true) },
      ]))
      if (!ok) return
    }
    try {
      setBusy('Getting your location…')
      const coords = await currentCoords()
      setBusy('Starting pickup…')
      const p = await startJob(dev.id, coords)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      router.replace(`/job/${p.id}`)
    } catch (e) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
      Alert.alert('Could not start pickup', (e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  // Old WasteID "Service Device": serviced without collecting waste. Recorded as a 0 L pickup (to confirm with the client).
  function recordService() {
    Alert.prompt('Service only', 'Record that this device was serviced without collecting any waste. Add a note if needed.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Record service', onPress: async (note?: string) => {
          if (!dev) return
          try {
            setBusy('Getting your location…')
            const coords = await currentCoords()
            setBusy('Saving…')
            const p = await serviceOnly(dev.id, { note: note || '', coords })
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            router.replace(`/job/${p.id}`)
          } catch (e) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
            Alert.alert('Could not record the service', (e as Error).message)
          } finally {
            setBusy(null)
          }
        },
      },
    ], 'plain-text')
  }

  function directions() {
    if (dev?.lat == null || dev?.lng == null) return
    const q = encodeURIComponent(deviceTitle(dev, loc))
    Linking.openURL(`maps://?daddr=${dev.lat},${dev.lng}&q=${q}`)
  }

  let action: React.ReactNode = null
  if (canWrite) {
    if (ongoing && profile && ongoing.driverId === profile.driverId) {
      action = <Button title="Finish pickup" kind="success" icon="checkmark.circle.fill" onPress={() => router.push(`/job/${ongoing.id}`)} />
    } else if (ongoing) {
      const who = ongoing.driverId ? ix.drivers.get(ongoing.driverId)?.name : null
      action = <Button title={`In progress${who ? ` · ${who}` : ''}`} kind="secondary" icon="truck.box.fill" onPress={() => router.push(`/job/${ongoing.id}`)} />
    } else if (!profile) {
      action = <Button title="Choose driver & vehicle" icon="person.crop.circle.badge.checkmark" onPress={() => router.push('/setup')} />
    } else if (myOngoing) {
      action = <Button title="Finish your current pickup first" kind="secondary" icon="arrow.uturn.right" onPress={() => router.push(`/job/${myOngoing.id}`)} />
    } else {
      action = (
        <>
          <Button testID="device-start" title={busy || 'Start pickup'} icon="play.fill" onPress={start} loading={!!busy} />
          <Button testID="device-service-only" title="Service only · no waste collected" kind="ghost" size="md" onPress={recordService} disabled={!!busy} style={{ marginTop: 4 }} />
        </>
      )
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: dev.ref }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: action ? 170 : 40 }}>
        <Card>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <IconBadge name="drop.fill" tone="primary" size={52} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.title}>{deviceTitle(dev, loc)}</Text>
              <Text style={s.sub}>{[dev.type, dev.waste].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <View style={s.pills}>
            {ongoing ? <Pill label="Pickup in progress" tone="primary" icon="truck.box.fill" /> : <DueBadge device={dev} />}
            <Pill label={dev.status} tone={dev.status === 'Active' ? 'success' : 'neutral'} />
            {away != null ? <Pill label={`${fmtM(away)} away`} tone="neutral" icon="location.fill" /> : null}
          </View>
        </Card>

        <View style={[s.banner, { backgroundColor: toneColor(banner[due.state]).bg }]}>
          <Icon name={due.state === 'overdue' ? 'exclamationmark.triangle.fill' : 'calendar'} size={20} color={toneColor(banner[due.state]).fg} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bannerTitle, { color: toneColor(banner[due.state]).fg }]}>
              {due.state === 'unknown' ? 'No service schedule' : `Next service ${fmtDate(nextService(dev))}`}
            </Text>
            <Text style={s.bannerSub}>Last serviced {fmtDate(dev.lastService)}{dev.freqWeeks ? ` · every ${dev.freqWeeks} weeks` : ''}</Text>
          </View>
        </View>

        <View style={s.grid}>
          <Tile label="Capacity" value={fmtL(dev.capacity)} />
          <Tile label="Frequency" value={dev.freqWeeks ? `${dev.freqWeeks} wk` : '—'} />
          <Tile label="Risk" value={dev.risk || '—'} />
          <Tile label="Category" value={dev.approvalCategory || '—'} />
        </View>

        <SectionTitle title="Location" />
        <Card style={s.group}>
          <Row icon="mappin.and.ellipse" title={loc?.name || 'Unknown location'} subtitle={addressOf(loc) || 'No address on file'} />
          {dev.locationDesc ? (<><Divider /><Row icon="text.bubble.fill" tone="neutral" title="Where to find it" subtitle={dev.locationDesc} /></>) : null}
          {dev.comments ? (<><Divider /><Row icon="note.text" tone="neutral" title="Comments" subtitle={dev.comments} /></>) : null}
          {company ? (<><Divider /><Row icon="building.2.fill" tone="neutral" title={company.name} subtitle="Responsible transport company" /></>) : null}
          {dev.lat != null ? (<><Divider /><Row icon="arrow.triangle.turn.up.right.diamond.fill" tone="success" title="Directions" subtitle="Open in Apple Maps" onPress={directions} /></>) : null}
        </Card>

        <SectionTitle title="Problems" />
        <Card style={s.group}>
          {issues.map((i, n) => (
            <View key={i.id}>{n > 0 && <Divider />}
              <Row icon="exclamationmark.bubble.fill" tone="warning" title={issueLabel(i.category)}
                subtitle={[i.description, `${fmtDate(i.at)}${i.reportedBy ? ` · ${i.reportedBy}` : ''}`].filter(Boolean).join('\n')} />
            </View>
          ))}
          {!issues.length && !canWrite ? <EmptyState icon="checkmark.seal" title="No open problems" /> : null}
          {canWrite ? (
            <>
              {issues.length ? <Divider /> : null}
              <Row testID="device-report-issue" icon="plus.bubble.fill" tone="neutral" title="Report a problem"
                subtitle={issues.length ? undefined : 'No open problems'} onPress={() => router.push(`/issue/${dev.id}`)} />
            </>
          ) : null}
        </Card>

        <SectionTitle title="Recent pickups" />
        <Card style={s.group}>
          {history.length ? history.map((p, i) => (
            <View key={p.id}>{i > 0 && <Divider />}<JobRow pickup={p} showDriver /></View>
          )) : <EmptyState icon="clock" title="No pickups recorded" />}
        </Card>
      </ScrollView>

      {action ? <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>{action}</View> : null}
    </View>
  )
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.tile}>
      <Text style={s.tileLabel}>{label}</Text>
      <Text style={s.tileValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  title: { fontSize: 21, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.md, marginTop: 12 },
  bannerTitle: { fontSize: 16, fontWeight: '700' },
  bannerSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.md, paddingVertical: 12, paddingHorizontal: 10 },
  tileLabel: { fontSize: 11, fontWeight: '700', color: colors.faint, textTransform: 'uppercase', letterSpacing: 0.4 },
  tileValue: { fontSize: 17, fontWeight: '800', color: colors.text, marginTop: 4 },
  group: { padding: 0, overflow: 'hidden' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: 'rgba(242,245,248,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
})
