import * as Haptics from 'expo-haptics'
import type { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Icon, type SfName } from './ui'

// The tab bar props as expo-router's Tabs declares them (React Navigation's BottomTabBarProps).
type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0]

export interface TabSpec { name: string; label: string; icon: SfName; iconSelected: SfName; testID?: string }

// A floating, opaque tab bar (white card, hairline border, soft shadow, tinted pill behind the selected tab).
// Drawn by us rather than the system so it reads the same on every iOS version: iOS 26's glass bar let the
// content show through and the labels got lost over text.
//
// No hooks in here: expo-router calls `tabBar(props)` as a plain function inside a Context.Consumer render
// prop, not as a component, so a hook throws "Invalid hook call" and a Release build aborts on launch
// (build 17 crashed as soon as a signed-in user reached the tabs). The safe-area insets come in as a prop.
export function makeTabBar(tabs: TabSpec[], tint: string, tintSoft: string) {
  return function TabBar({ state, navigateToTab, insets }: TabBarProps) {
    return (
      <View pointerEvents="box-none" style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={s.bar} accessibilityRole="tablist">
          {state.routes.map((route, i) => {
            const spec = tabs.find((t) => t.name === route.name)
            if (!spec) return null
            const on = state.index === i
            return (
              <Pressable key={route.key} testID={spec.testID || `tab-${spec.name}`} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={spec.label}
                onPress={() => { if (!on) { Haptics.selectionAsync(); navigateToTab(route.key) } }}
                style={[s.tab, on && { backgroundColor: tintSoft }]}>
                <Icon name={on ? spec.iconSelected : spec.icon} size={21} color={on ? tint : '#64748b'} />
                <Text style={[s.label, on && { color: tint }]} numberOfLines={1}>{spec.label}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
    )
  }
}

const s = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  bar: { flexDirection: 'row', gap: 4, padding: 6, borderRadius: 22, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E3E8EE',
    shadowColor: '#0F1B2A', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  tab: { flex: 1, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', gap: 3 },
  label: { fontSize: 10.5, fontWeight: '600', color: '#64748b' },
})
