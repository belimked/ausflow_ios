import { LinearGradient } from 'expo-linear-gradient'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { DeviceRow, JobRow } from '@/components/items'
import { Button, Card, Divider, EmptyState, Icon, SectionTitle, Stat } from '@/components/ui'
import { ENV_LABEL } from '@/lib/config'
import { deviceTitle, dueState, fmtDuration, fmtL, fmtTime, nextService, startOfDay } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { colors, gradient, radius, shadow } from '@/lib/theme'
import { useNow } from '@/lib/useNow'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, session, profile, loading, error, refresh, canWrite } = useStore()
  const ix = useIndex()
  useNow()

  const driver = profile ? ix.drivers.get(profile.driverId) : undefined
  const vehicle = profile ? ix.vehicles.get(profile.vehicleId) : undefined
  const company = profile ? ix.companies.get(profile.companyId) : undefined
  const firstName = (driver?.name || session?.user.displayName || '').replace(/\(.*?\)/g, '').trim().split(' ')[0]

  const view = useMemo(() => {
    if (!data) return null
    const today = startOfDay()
    const mine = data.pickups.filter((p) => profile && p.driverId === profile.driverId)
    const ongoing = mine.find((p) => p.status === 'ongoing')
    const doneToday = mine.filter((p) => p.status === 'done' && p.endAt && new Date(p.endAt).getTime() >= today)
      .sort((a, b) => (b.endAt || '').localeCompare(a.endAt || ''))
    const fleet = data.devices.filter((d) => d.status === 'Active' && (!profile || d.companyId === profile.companyId))
    const overdue = fleet.filter((d) => dueState(d).state === 'overdue').length
    const dueNext = fleet.filter((d) => nextService(d) && !ix.ongoingByDevice.has(d.id))
      .sort((a, b) => nextService(a)!.localeCompare(nextService(b)!)).slice(0, 5)
    return { ongoing, doneToday, litres: doneToday.reduce((n, p) => n + (p.volume || 0), 0), overdue, dueNext }
  }, [data, profile, ix])

  if (!data) {
    return (
      <View style={[s.center, { backgroundColor: colors.bg }]}>
        {error ? (
          <EmptyState icon="wifi.exclamationmark" title="Couldn't load data" message={error} action={<Button title="Try again" icon="arrow.clockwise" onPress={refresh} size="md" />} />
        ) : <ActivityIndicator size="large" color={colors.primary} />}
      </View>
    )
  }

  const ongoingDev = view?.ongoing?.deviceId ? ix.devices.get(view.ongoing.deviceId) : undefined
  const ongoingLoc = view?.ongoing?.locationId ? ix.locations.get(view.ongoing.locationId) : undefined

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingBottom: 32 }}
      contentInsetAdjustmentBehavior="never"
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor="#fff" />}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 16 }]}>
        <View style={s.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={s.hello}>{greeting()}{firstName ? ',' : ''}</Text>
            {firstName ? <Text style={s.name}>{firstName}</Text> : null}
          </View>
          <View style={s.env}><Text style={s.envText}>{ENV_LABEL}</Text></View>
        </View>

        <Pressable onPress={() => router.push('/setup')} style={({ pressed }) => [s.workAs, pressed && { opacity: 0.85 }]}>
          <View style={s.workIcon}><Icon name="truck.box.fill" size={20} color="#fff" /></View>
          {profile && driver && vehicle ? (
            <View style={{ flex: 1 }}>
              <Text style={s.workTitle} numberOfLines={1}>{driver.name} · {vehicle.plate}</Text>
              <Text style={s.workSub} numberOfLines={1}>{company?.name}</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Text style={s.workTitle}>Choose driver & vehicle</Text>
              <Text style={s.workSub}>Needed before you can record pickups</Text>
            </View>
          )}
          <Icon name="chevron.right" size={13} color="rgba(255,255,255,0.8)" />
        </Pressable>
      </LinearGradient>

      <View style={s.body}>
        {view?.ongoing ? (
          <Card style={s.live} onPress={() => router.push(`/job/${view.ongoing!.id}`)}>
            <View style={s.liveHead}>
              <View style={s.dot} />
              <Text style={s.liveLabel}>PICKUP IN PROGRESS</Text>
              <Text style={s.liveTime}>{fmtDuration(view.ongoing.startAt!)}</Text>
            </View>
            <Text style={s.liveTitle} numberOfLines={1}>{deviceTitle(ongoingDev, ongoingLoc)}</Text>
            <Text style={s.liveSub}>Started {fmtTime(view.ongoing.startAt)} · {ongoingDev?.ref}{ongoingDev?.capacity ? ` · ${fmtL(ongoingDev.capacity)} trap` : ''}</Text>
            <Button title="Finish pickup" icon="checkmark.circle.fill" kind="success" onPress={() => router.push(`/job/${view.ongoing!.id}`)} style={{ marginTop: 14 }} />
          </Card>
        ) : (
          <Pressable
            disabled={!canWrite}
            onPress={() => router.push(profile ? '/scan' : '/setup')}
            style={({ pressed }) => [s.scan, !canWrite && { opacity: 0.6 }, pressed && { transform: [{ scale: 0.98 }] }]}>
            <View style={s.scanIcon}><Icon name="qrcode.viewfinder" size={30} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.scanTitle}>Scan device QR</Text>
              <Text style={s.scanSub}>{canWrite ? 'Start a pickup at a grease trap' : 'Your account is view-only'}</Text>
            </View>
            <Icon name="chevron.right" size={15} color={colors.faint} />
          </Pressable>
        )}

        {vehicle ? (
          <OnBoard litres={Math.max(0, ix.loads.get(vehicle.id) || 0)} tank={vehicle.tank || 0} plate={vehicle.plate}
            onPress={() => router.push('/vehicle')} onOffload={canWrite ? () => router.push('/offload') : undefined} />
        ) : null}

        <View style={s.stats}>
          <Stat label="Pickups today" value={String(view?.doneToday.length || 0)} icon="checkmark.circle.fill" tone="success" />
          <Stat label="Collected" value={fmtL(view?.litres || 0)} icon="drop.fill" tone="primary" />
          <Stat label="Overdue" value={String(view?.overdue || 0)} icon="exclamationmark.triangle.fill" tone={view?.overdue ? 'danger' : 'neutral'} />
        </View>

        <SectionTitle title="Due next" right={
          <Pressable onPress={() => router.navigate('/devices')} hitSlop={8}><Text style={s.link}>See all</Text></Pressable>
        } />
        <Card style={s.list}>
          {view?.dueNext.length ? view.dueNext.map((d, i) => (
            <View key={d.id}>{i > 0 && <Divider />}<DeviceRow device={d} /></View>
          )) : <EmptyState icon="checkmark.seal.fill" title="Nothing due" message="All devices are up to date." />}
        </Card>

        <SectionTitle title="Completed today" />
        <Card style={s.list}>
          {view?.doneToday.length ? view.doneToday.map((p, i) => (
            <View key={p.id}>{i > 0 && <Divider />}<JobRow pickup={p} /></View>
          )) : <EmptyState icon="tray" title="No pickups yet today" message="Completed pickups will show up here." />}
        </Card>
      </View>
    </ScrollView>
  )
}

// Waste on board the selected vehicle; red from 90 % of the tank, like the web console's load gauge.
function OnBoard({ litres, tank, plate, onPress, onOffload }: { litres: number; tank: number; plate: string; onPress: () => void; onOffload?: () => void }) {
  const pct = tank ? Math.min(1, litres / tank) : 0
  const full = tank > 0 && litres / tank >= 0.9
  return (
    <Card style={s.load} onPress={onPress}>
      <View style={s.loadHead}>
        <Text style={s.loadLabel}>ON BOARD · {plate}</Text>
        <Text style={[s.loadValue, full && { color: colors.danger }]}>
          {fmtL(litres)}{tank ? <Text style={s.loadTank}> / {fmtL(tank)}</Text> : null}
        </Text>
      </View>
      {tank ? (
        <View style={s.bar}>
          <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: full ? colors.danger : colors.primaryBright }]} />
        </View>
      ) : null}
      {onOffload && litres > 0 ? (
        <Button testID="today-offload" title="Offload waste" kind="success" icon="arrow.down.to.line" size="md" onPress={onOffload} style={{ marginTop: 12 }} />
      ) : null}
    </Card>
  )
}

const s = StyleSheet.create({
  load: { marginTop: 14, paddingVertical: 14 },
  loadHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  loadLabel: { flexShrink: 1, fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6 },
  loadValue: { fontSize: 18, fontWeight: '800', color: colors.text },
  loadTank: { fontSize: 13, fontWeight: '600', color: colors.faint },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.bg, marginTop: 10, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { paddingHorizontal: 20, paddingBottom: 56, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  hello: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600' },
  name: { color: '#fff', fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  env: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.2)', marginTop: 4 },
  envText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  workAs: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  workIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  workTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  workSub: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 1 },
  body: { paddingHorizontal: 16, marginTop: -40 },
  scan: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: radius.lg, backgroundColor: colors.card, ...shadow, shadowOpacity: 0.1 },
  scanIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  scanTitle: { fontSize: 19, fontWeight: '800', color: colors.text },
  scanSub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  live: { borderWidth: 2, borderColor: colors.primaryBright, shadowOpacity: 0.12 },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  liveLabel: { flex: 1, fontSize: 12, fontWeight: '800', color: colors.primary, letterSpacing: 0.6 },
  liveTime: { fontSize: 13, fontWeight: '700', color: colors.muted },
  liveTitle: { fontSize: 21, fontWeight: '800', color: colors.text, marginTop: 10 },
  liveSub: { fontSize: 14, color: colors.muted, marginTop: 3 },
  stats: { flexDirection: 'row', gap: 10, marginTop: 14 },
  list: { padding: 0, overflow: 'hidden' },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
})
