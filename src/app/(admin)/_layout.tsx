import { NativeTabs } from 'expo-router/native-tabs'
import { admin } from '@/lib/theme'

// Console tabs for admin / authority / view-only users. Drivers get (tabs); see lib/role.ts.
export default function AdminTabLayout() {
  return (
    <NativeTabs tintColor={admin.primary}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Dashboard</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gauge.with.dots.needle.33percent', selected: 'gauge.with.dots.needle.33percent' }} md="speed" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="devices">
        <NativeTabs.Trigger.Label>Devices</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'drop', selected: 'drop.fill' }} md="water_drop" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="records">
        <NativeTabs.Trigger.Label>Records</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }} md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="me">
        <NativeTabs.Trigger.Label>Me</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }} md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
