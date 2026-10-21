import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button, Card, Divider, Pill, Row, ScreenHeader, SectionTitle } from '@/components/ui'
import { API_BASE, ENV_LABEL } from '@/lib/config'
import { fmtDateTime, fmtL, fmtTime, initials } from '@/lib/format'
import { describeItem, itemTime } from '@/lib/offline/describe'
import { useIndex, useStore } from '@/lib/store'
import { colors } from '@/lib/theme'

const ROLE: Record<string, string> = { admin: 'Admin', authority: 'Admin', ops: 'Operations', user: 'View only' }

export default function Profile() {
  const router = useRouter()
  const { session, profile, loadedAt, loading, refresh, signOut, data, online, pending, syncing, problems, syncNow, retryProblem, discardProblem } = useStore()
  const ix = useIndex()
  const user = session?.user
  const driver = profile ? ix.drivers.get(profile.driverId) : undefined
  const vehicle = profile ? ix.vehicles.get(profile.vehicleId) : undefined
  const company = profile ? ix.companies.get(profile.companyId) : undefined

  function confirmSignOut() {
    const waiting = pending ? ` ${pending} item(s) waiting to be sent stay on this phone and go out after you sign in again.` : ''
    Alert.alert('Sign out?', `You will need your password to sign in again.${waiting}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ])
  }

  function openProblem(i: number) {
    const p = problems[i]
    Alert.alert(describeItem(p.item, ref), p.reason, [
      { text: 'Keep for now', style: 'cancel' },
      { text: 'Try again', onPress: () => retryProblem(i) },
      {
        text: 'Discard', style: 'destructive', onPress: () => Alert.alert('Discard this record?', 'It will not reach the office. This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => discardProblem(i) },
        ]),
      },
    ])
  }

  const ref = (id: string) => ix.devices.get(id)?.ref
  const status = !online ? 'Offline' : syncing ? 'Sending…' : pending ? 'Waiting to send' : 'Up to date'

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 40 }}>
      <ScreenHeader title="Me" />
      <View style={{ paddingHorizontal: 16 }}>
        <Card style={s.user}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials(user?.displayName || '')}</Text></View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={s.name}>{user?.displayName}</Text>
            <Text style={s.username}>@{user?.username}</Text>
            <Pill label={ROLE[user?.role || ''] || user?.role || ''} tone={user?.role === 'user' ? 'neutral' : 'primary'} />
          </View>
        </Card>

        <SectionTitle title="Working as" />
        <Card style={s.group}>
          <Row icon="person.fill" title={driver?.name || 'No driver selected'} subtitle={driver?.phone ? `Driver · ${driver.phone}` : 'Driver'} onPress={() => router.push('/setup')} />
          <Divider />
          <Row icon="truck.box.fill" title={vehicle?.plate || 'No vehicle selected'} subtitle={vehicle ? `${vehicle.type === 'large' ? 'Large truck' : 'Small truck'}${vehicle.tank ? ` · ${vehicle.tank.toLocaleString('en-AU')} L tank` : ''}` : 'Vehicle'} onPress={() => router.push('/setup')} />
          <Divider />
          <Row icon="building.2.fill" title={company?.name || 'No company selected'} subtitle="Transport company" onPress={() => router.push('/setup')} />
          {vehicle ? (
            <>
              <Divider />
              <Row icon="drop.fill" tone="neutral" title={fmtL(Math.max(0, ix.loads.get(vehicle.id) || 0))}
                subtitle={vehicle.tank ? `On board · ${fmtL(vehicle.tank)} tank` : 'On board'} />
            </>
          ) : null}
        </Card>

        <SectionTitle title="Sync" />
        <Card style={s.group}>
          <Row testID="sync-now" icon={online ? 'icloud.fill' : 'icloud.slash.fill'} tone={!online || problems.length ? 'warning' : 'success'} title={status}
            subtitle={pending ? `${pending} item(s) recorded on this phone, not yet sent` : 'Everything recorded on this phone has been sent'}
            onPress={pending && online && !syncing ? syncNow : undefined} right={pending && online && !syncing ? <Text style={s.link}>Send now</Text> : null} chevron={false} />
          {problems.map((p, i) => (
            <View key={p.item.key}>
              <Divider />
              <Row icon="exclamationmark.triangle.fill" tone="danger" title={describeItem(p.item, ref)}
                subtitle={`${itemTime(p.item) ? `${fmtDateTime(itemTime(p.item))} · ` : ''}${p.reason}`} onPress={() => openProblem(i)} />
            </View>
          ))}
        </Card>

        <SectionTitle title="Data" />
        <Card style={s.group}>
          <Row icon="arrow.triangle.2.circlepath" tone="success" title="Refresh data"
            subtitle={loadedAt ? `Last updated ${fmtTime(new Date(loadedAt).toISOString())} · ${data?.devices.length || 0} devices · ${data?.facilities.length || 0} facilities` : 'Not loaded yet'}
            onPress={refresh} chevron={false} right={loading ? <Text style={s.muted}>Updating…</Text> : null} />
          <Divider />
          <Row icon="server.rack" tone="neutral" title={`${ENV_LABEL} environment`} subtitle={API_BASE.replace('https://', '')} />
          <Divider />
          <Row icon="info.circle.fill" tone="neutral" title="App version" subtitle={`${Constants.expoConfig?.version || '1.0.0'}`} />
        </Card>

        <Button testID="sign-out" title="Sign out" kind="danger" icon="rectangle.portrait.and.arrow.right" onPress={confirmSignOut} style={{ marginTop: 28 }} />
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  user: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  username: { fontSize: 14, color: colors.muted },
  group: { padding: 0, overflow: 'hidden' },
  muted: { color: colors.muted, fontSize: 13 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
})
