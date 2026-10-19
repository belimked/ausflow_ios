import { useRouter } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { addressOf, deviceTitle, dueState, fmtL, fmtM, fmtTime, fmtDuration, type DueState } from '@/lib/format'
import { useIndex } from '@/lib/store'
import { colors } from '@/lib/theme'
import type { Device, Pickup } from '@/lib/types'
import { Icon, IconBadge, Pill } from './ui'

const DUE_TONE: Record<DueState, 'danger' | 'warning' | 'success' | 'neutral'> = { overdue: 'danger', soon: 'warning', ok: 'success', unknown: 'neutral' }

export function DueBadge({ device }: { device: Device }) {
  const d = dueState(device)
  return <Pill label={d.label} tone={DUE_TONE[d.state]} icon={d.state === 'overdue' ? 'exclamationmark.triangle.fill' : d.state === 'soon' ? 'clock.fill' : undefined} />
}

export function DeviceRow({ device, distance }: { device: Device; distance?: number | null }) {
  const router = useRouter()
  const ix = useIndex()
  const loc = device.locationId ? ix.locations.get(device.locationId) : undefined
  const busy = ix.ongoingByDevice.get(device.id)
  const due = dueState(device)
  return (
    <Pressable onPress={() => router.push(`/device/${device.id}`)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
      <IconBadge name="drop.fill" tone={busy ? 'primary' : DUE_TONE[due.state] === 'neutral' ? 'neutral' : DUE_TONE[due.state]} size={42} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.title} numberOfLines={1}>{deviceTitle(device, loc)}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {[device.ref, addressOf(loc) || device.locationDesc].filter(Boolean).join(' · ')}
        </Text>
        <View style={s.meta}>
          {busy ? <Pill label="In progress" tone="primary" icon="truck.box.fill" /> : <DueBadge device={device} />}
          {device.capacity ? <Text style={s.metaText}>{fmtL(device.capacity)}</Text> : null}
          {distance != null ? <Text style={s.metaText}>· {fmtM(distance)}</Text> : null}
        </View>
      </View>
      <Icon name="chevron.right" size={13} color={colors.faint} />
    </Pressable>
  )
}

export function FlagPills({ pickup }: { pickup: Pickup }) {
  const flags = pickup.flags || []
  if (!flags.length) return null
  return (
    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
      {flags.includes('location') && <Pill label="Away from device" tone="warning" icon="location.slash.fill" />}
      {flags.includes('nolocation') && <Pill label="No GPS" tone="warning" icon="location.slash.fill" />}
      {flags.includes('capacity') && <Pill label="Over capacity" tone="danger" icon="exclamationmark.triangle.fill" />}
    </View>
  )
}

export function JobRow({ pickup, showDriver }: { pickup: Pickup; showDriver?: boolean }) {
  const router = useRouter()
  const ix = useIndex()
  const dev = pickup.deviceId ? ix.devices.get(pickup.deviceId) : undefined
  const loc = pickup.locationId ? ix.locations.get(pickup.locationId) : undefined
  const driver = pickup.driverId ? ix.drivers.get(pickup.driverId) : undefined
  const vehicle = pickup.vehicleId ? ix.vehicles.get(pickup.vehicleId) : undefined
  const ongoing = pickup.status === 'ongoing'
  const when = ongoing ? `Started ${fmtTime(pickup.startAt)} · ${fmtDuration(pickup.startAt!)}` : `${fmtTime(pickup.startAt)} – ${fmtTime(pickup.endAt)}`
  return (
    <Pressable onPress={() => router.push(`/job/${pickup.id}`)} style={({ pressed }) => [s.row, pressed && s.pressed]}>
      <IconBadge name={ongoing ? 'truck.box.fill' : 'checkmark'} tone={ongoing ? 'primary' : (pickup.flags?.length ? 'warning' : 'success')} size={42} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={s.title} numberOfLines={1}>{deviceTitle(dev, loc)}</Text>
        <Text style={s.sub} numberOfLines={1}>
          {[when, showDriver ? driver?.name : null, vehicle?.plate].filter(Boolean).join(' · ')}
        </Text>
        {pickup.flags?.length ? <FlagPills pickup={pickup} /> : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: 4 }}>
        {ongoing ? <Pill label="Live" tone="primary" /> : <Text style={s.volume}>{fmtL(pickup.volume)}</Text>}
      </View>
    </Pressable>
  )
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  pressed: { backgroundColor: '#F6F8FA' },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  sub: { fontSize: 13, color: colors.muted },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaText: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  volume: { fontSize: 15, fontWeight: '700', color: colors.text },
})
