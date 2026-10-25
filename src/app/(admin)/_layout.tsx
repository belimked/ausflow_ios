import { Tabs } from 'expo-router'
import { makeTabBar } from '@/components/TabBar'
import { admin } from '@/lib/theme'

// Console tabs for admin / authority / view-only users. Drivers get (tabs); see lib/role.ts.
const TabBar = makeTabBar([
  { name: 'index', label: 'Dashboard', icon: 'gauge.with.dots.needle.33percent', iconSelected: 'gauge.with.dots.needle.33percent' },
  { name: 'devices', label: 'Devices', icon: 'drop', iconSelected: 'drop.fill' },
  { name: 'records', label: 'Records', icon: 'list.bullet.rectangle', iconSelected: 'list.bullet.rectangle.fill' },
  { name: 'me', label: 'Me', icon: 'person.crop.circle', iconSelected: 'person.crop.circle.fill' },
], admin.primary, admin.primaryTint)

export default function AdminTabLayout() {
  return (
    <Tabs tabBar={TabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: admin.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="devices" />
      <Tabs.Screen name="records" />
      <Tabs.Screen name="me" />
    </Tabs>
  )
}
