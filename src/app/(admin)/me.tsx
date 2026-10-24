import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, Tag } from '@/components/admin'
import { API_BASE, ENV_LABEL } from '@/lib/config'
import { fmtDateTime, initials } from '@/lib/format'
import { alertCounts, alertViews } from '@/lib/alerts'
import { ROLE_LABEL } from '@/lib/role'
import { useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

export default function AdminMe() {
  const router = useRouter()
  const { session, data, loadedAt, loading, refresh, signOut, online, syncing, pending, setViewMode, canWrite } = useStore()
  const user = session?.user
  const openIssues = (data?.reportedIssues || []).filter((i) => i.status !== 'resolved').length
  const alerts = useMemo(() => alertCounts(data ? alertViews(data) : []), [data])

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your password to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, sign out', style: 'destructive', onPress: signOut },
    ])
  }
  const status = !online ? 'Offline · showing the last copy on this phone' : syncing ? 'Refreshing…' : loadedAt ? `Up to date · ${fmtDateTime(new Date(loadedAt).toISOString())}` : 'Not loaded yet'

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <AHeader title="Me">
        <ACard style={s.user}>
          <View style={s.avatar}><Text style={s.avatarText}>{initials(user?.displayName || '')}</Text></View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={s.name}>{user?.displayName}</Text>
            <Text style={s.handle}>@{user?.username}</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Tag label={ROLE_LABEL[user?.role || ''] || user?.role || ''} tone={canWrite ? 'blue' : 'slate'} />
              <Tag label="Console view" tone="slate" />
            </View>
          </View>
        </ACard>
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.sec}>Console</Text>
        <ACard>
          <ARow icon="building.2.fill" title="Companies & people" subtitle={`${data?.companies.length ?? 0} companies · ${data?.drivers.length ?? 0} drivers · ${data?.vehicles.length ?? 0} vehicles`} onPress={() => router.push('/directory')} />
          <ARow icon="mappin.and.ellipse" title="Locations & facilities" subtitle={`${data?.locations.length ?? 0} locations · ${data?.facilities.length ?? 0} facilities`} onPress={() => router.push({ pathname: '/directory', params: { tab: 'locations' } })} />
          <ARow icon="exclamationmark.bubble.fill" iconTone={openIssues ? 'rose' : 'blue'} title="Reported issues" subtitle={openIssues ? `${openIssues} open` : 'Nothing open'} onPress={() => router.navigate({ pathname: '/devices', params: { filter: 'all' } })} />
          <ARow icon="bell.fill" iconTone={alerts.unread ? 'rose' : 'blue'} title="Alerts" subtitle={`${alerts.active} open · ${alerts.unread} unread`} onPress={() => router.push('/alerts')} right={alerts.unread ? <View style={s.cnt}><Text style={s.cntText}>{alerts.unread}</Text></View> : undefined} />
          <ARow icon="text.bubble.fill" title="Ops tickets" subtitle="Email tickets handled by the office" onPress={() => router.push('/tickets')} />
          <ARow icon="qrcode" title="QR codes & labels" subtitle="Device labels, vehicle stickers, driver badges" onPress={() => router.push('/qr')} last />
        </ACard>

        <Text style={s.sec}>Account</Text>
        <ACard>
          <ARow icon="person.fill" iconTone="slate" title="My details" subtitle="Name, email and password" onPress={() => router.push('/details')} testID="me-details" />
          <ARow icon="truck.box.fill" iconTone="slate" title="Switch to driver view" subtitle="Today / History tabs · record pickups yourself" onPress={() => setViewMode('driver')} testID="me-switch-driver" last />
        </ACard>

        <Text style={s.sec}>Data</Text>
        <ACard>
          <ARow icon={online ? 'checkmark.circle.fill' : 'wifi.slash'} iconTone={online ? 'green' : 'amber'} title={status.split(' · ')[0]}
            subtitle={`${status.split(' · ')[1] || ''}${data ? ` · ${data.devices.length} devices · ${data.facilities.length} facilities` : ''}`} onPress={() => refresh()} />
          {pending ? <ARow icon="tray.full.fill" iconTone="amber" title={`${pending} record${pending === 1 ? '' : 's'} waiting to send`} subtitle="Recorded in the driver view; sent when online" /> : null}
          <ARow icon="server.rack" iconTone="slate" title={`${ENV_LABEL} environment`} subtitle={`${API_BASE.replace('https://', '')} · app ${Constants.expoConfig?.version}`} last />
        </ACard>

        <View style={{ height: 8 }} />
        <ACard onPress={confirmSignOut} style={s.signOut} testID="me-sign-out"><Text style={s.signOutText}>{loading ? 'Sign out' : 'Sign out'}</Text></ACard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, paddingTop: 4, gap: 8, paddingBottom: 120 },
  user: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: c.bg },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  name: { fontSize: 16, fontWeight: '700', color: c.text },
  handle: { fontSize: 11.5, color: c.faint, fontFamily: 'Menlo' },
  sec: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: c.faint, textTransform: 'uppercase', paddingHorizontal: 2, paddingTop: 8 },
  cnt: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: c.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  cntText: { fontSize: 11, fontWeight: '600', color: c.dangerText },
  signOut: { backgroundColor: c.dangerSoft, borderColor: c.dangerSoft, alignItems: 'center', paddingVertical: 13 },
  signOutText: { color: c.dangerText, fontWeight: '600', fontSize: 13 },
})
