import { Tabs } from 'expo-router'
import { makeTabBar } from '@/components/TabBar'
import { colors } from '@/lib/theme'

// Driver tabs. The bar is our own component (see components/TabBar.tsx), not the system tab bar.
const TabBar = makeTabBar([
  { name: 'index', label: 'Today', icon: 'sun.max', iconSelected: 'sun.max.fill' },
  { name: 'jobs', label: 'History', icon: 'list.bullet.rectangle', iconSelected: 'list.bullet.rectangle.fill' },
  { name: 'devices', label: 'Devices', icon: 'drop', iconSelected: 'drop.fill' },
  { name: 'profile', label: 'Me', icon: 'person.crop.circle', iconSelected: 'person.crop.circle.fill' },
], colors.primary, colors.primarySoft)

export default function TabLayout() {
  return (
    <Tabs tabBar={TabBar} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="jobs" />
      <Tabs.Screen name="devices" />
      <Tabs.Screen name="profile" />
    </Tabs>
  )
}
