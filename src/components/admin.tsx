import * as Haptics from 'expo-haptics'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { admin as c, adminShadow } from '@/lib/theme'
import { Icon, type SfName } from './ui'

// Console building blocks (admin view). Same vocabulary as the web console's layout D: white cards with a
// 1 px border, slate text, blue primary, iOS segmented controls, tags with a dot, mono numbers.

export type ATone = 'green' | 'amber' | 'rose' | 'slate' | 'blue'
const TONE: Record<ATone, { bg: string; fg: string }> = {
  green: { bg: c.successSoft, fg: c.successText },
  amber: { bg: c.warningSoft, fg: c.warningText },
  rose: { bg: c.dangerSoft, fg: c.dangerText },
  slate: { bg: c.hairline, fg: c.muted },
  blue: { bg: c.primarySoft, fg: c.primaryDark },
}
export const toneOf = (t: ATone) => TONE[t]

export function Tag({ label, tone = 'slate', dot = tone !== 'slate', mono }: { label: string; tone?: ATone; dot?: boolean; mono?: boolean }) {
  const t = TONE[tone]
  return (
    <View style={[s.tag, { backgroundColor: t.bg }]}>
      {dot ? <View style={[s.tagDot, { backgroundColor: t.fg }]} /> : null}
      <Text style={[s.tagText, { color: t.fg }, mono && s.mono]} numberOfLines={1}>{label}</Text>
    </View>
  )
}

export function Mono({ children, style }: { children: ReactNode; style?: StyleProp<any> }) {
  return <Text style={[s.mono, style]}>{children}</Text>
}

// Screen header: eyebrow + title on white, optional right slot and extra rows (search, segmented control).
export function AHeader({ eyebrow, title, subtitle, right, back, children }: {
  eyebrow?: string; title: string; subtitle?: string; right?: ReactNode; back?: () => void; children?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[s.header, { paddingTop: insets.top + 6 }]}>
      <View style={s.headerRow}>
        {back ? (
          <Pressable onPress={back} hitSlop={8} style={s.iconBtn} accessibilityLabel="Back">
            <Icon name="chevron.left" size={18} color={c.body} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          {eyebrow ? <Text style={s.eyebrow}>{eyebrow}</Text> : null}
          <Text style={s.title} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={s.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
}

export function IconButton({ name, onPress, label, primary, testID }: { name: SfName; onPress: () => void; label: string; primary?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} accessibilityLabel={label} style={({ pressed }) => [s.iconBtn, primary && s.iconBtnPrimary, pressed && { opacity: 0.8 }]}>
      <Icon name={name} size={18} color={primary ? '#fff' : c.body} />
    </Pressable>
  )
}

export function StatusStrip({ items, right }: { items: { label: string; value?: string | number; color: string; onPress?: () => void }[]; right?: string }) {
  return (
    <View style={s.strip}>
      {items.map((it, i) => (
        <Pressable key={it.label} onPress={it.onPress} disabled={!it.onPress} style={s.stripItem}>
          {i > 0 ? <View style={s.stripSep} /> : null}
          <View style={[s.dot, { backgroundColor: it.color }]} />
          <Text style={s.stripLabel}>{it.label}</Text>
          {it.value != null ? <Text style={[s.mono, s.stripValue]}>{it.value}</Text> : null}
        </Pressable>
      ))}
      <View style={{ flex: 1 }} />
      {right ? <Text style={[s.mono, { fontSize: 11, color: c.faint }]}>{right}</Text> : null}
    </View>
  )
}

export function Segmented<T extends string>({ options, value, onChange, style }: {
  options: { key: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; style?: StyleProp<ViewStyle>
}) {
  return (
    <View style={[s.seg, style]}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <Pressable key={o.key} onPress={() => { if (!on) { Haptics.selectionAsync(); onChange(o.key) } }} style={[s.segBtn, on && s.segOn]} accessibilityState={{ selected: on }}>
            <Text style={[s.segText, on && s.segTextOn]} numberOfLines={1}>{o.label}{o.count != null ? ` ${o.count}` : ''}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function ACard({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (!onPress) return <View testID={testID} style={[s.card, style]}>{children}</View>
  return <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.9 }]}>{children}</Pressable>
}

export function SectionCard({ title, sub, right, children, style }: { title: string; sub?: string; right?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.card, style]}>
      <View style={s.secHead}>
        <View style={{ flex: 1 }}>
          <Text style={s.secTitle}>{title}</Text>
          {sub ? <Text style={s.secSub}>{sub}</Text> : null}
        </View>
        {right}
      </View>
      {children}
    </View>
  )
}

export function LinkText({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable onPress={onPress} hitSlop={8}><Text style={s.link}>{label}</Text></Pressable>
}

// Dashboard KPI tile: label + icon, big mono number with a badge, a note line, optional segmented bar.
export function Kpi({ label, value, badge, badgeTone = 'green', note, icon, iconColor = c.primary, segments, onPress, testID }: {
  label: string; value: string; badge?: string; badgeTone?: ATone; note?: string; icon: SfName; iconColor?: string
  segments?: { value: number; color: string }[]; onPress?: () => void; testID?: string
}) {
  return (
    <ACard onPress={onPress} testID={testID} style={s.kpi}>
      <View style={s.kpiHead}>
        <Text style={s.kpiLabel}>{label}</Text>
        <Icon name={icon} size={15} color={iconColor} />
      </View>
      <View style={s.kpiMain}>
        <Text style={[s.mono, s.kpiValue]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
        {badge ? <Tag label={badge} tone={badgeTone} /> : null}
      </View>
      {note ? <Text style={s.kpiNote} numberOfLines={1}>{note}</Text> : null}
      {segments ? (
        <View style={s.segbar}>
          {segments.filter((x) => x.value > 0).map((x, i) => <View key={i} style={{ flex: x.value, backgroundColor: x.color }} />)}
        </View>
      ) : null}
    </ACard>
  )
}

// Small bar chart made of views (no chart library). Touch and drag across it: the bars near the finger grow
// like a macOS Dock and a label above shows the value, so the exact figures are a press away.
const DOCK_REACH = 2.5
const DOCK_SCALE = 0.45

export function Bars({ rows, height = 72, color = c.primary, labels, tooltip }: {
  rows: number[]; height?: number; color?: string; labels?: (string | null)[]; tooltip?: (index: number) => string
}) {
  const max = Math.max(1, ...rows)
  const [active, setActive] = useState<number | null>(null)
  const [width, setWidth] = useState(0)
  // One animated scale per bar; rebuilt when the number of bars changes.
  const [scales, setScales] = useState(() => rows.map(() => new Animated.Value(1)))
  if (scales.length !== rows.length) setScales(rows.map((_, i) => scales[i] || new Animated.Value(1)))

  useEffect(() => {
    Animated.parallel(scales.map((v, i) => {
      const d = active == null ? Infinity : Math.abs(i - active)
      const target = d > DOCK_REACH ? 1 : 1 + DOCK_SCALE * (1 - d / DOCK_REACH)
      return Animated.spring(v, { toValue: target, useNativeDriver: true, speed: 30, bounciness: 6 })
    })).start()
  }, [active, scales])

  const pick = (e: GestureResponderEvent) => {
    if (!width || !rows.length) return
    const i = Math.min(rows.length - 1, Math.max(0, Math.floor((e.nativeEvent.locationX / width) * rows.length)))
    setActive((prev) => { if (prev !== i) Haptics.selectionAsync(); return i })
  }
  const slot = rows.length ? width / rows.length : 0
  const tipText = active != null ? (tooltip ? tooltip(active) : String(rows[active])) : ''
  // Keep the label inside the chart: clamp its centre to the chart width.
  const tipLeft = active != null ? Math.min(Math.max(slot * (active + 0.5), 60), Math.max(60, width - 60)) : 0

  return (
    <View style={{ paddingTop: 26 }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, height }}
        onStartShouldSetResponder={() => true} onMoveShouldSetResponder={() => true}
        onResponderGrant={pick} onResponderMove={pick} onResponderRelease={() => setActive(null)} onResponderTerminate={() => setActive(null)}>
        {rows.map((v, i) => (
          <Animated.View key={i} style={{
            flex: 1, height: Math.max(3, (v / max) * height), borderRadius: 3,
            backgroundColor: v ? (active === i ? c.primaryDark : color) : c.border,
            transform: [{ scaleY: scales[i] || 1 }], transformOrigin: 'bottom',
          }} />
        ))}
      </View>
      {active != null ? (
        <View pointerEvents="none" style={[s.tip, { left: tipLeft }]}>
          <Text style={s.tipText} numberOfLines={1}>{tipText}</Text>
          <View style={s.tipArrow} />
        </View>
      ) : null}
      {labels ? (
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
          {labels.map((l, i) => <Text key={i} style={[s.mono, { flex: 1, fontSize: 9, color: active === i ? c.text : c.faint, fontWeight: active === i ? '700' : '400', textAlign: 'center' }]} numberOfLines={1}>{l || ''}</Text>)}
        </View>
      ) : null}
    </View>
  )
}

// Ranked list row with a proportional bar underneath (overdue by company).
export function RankRow({ rank, label, value, ratio, color, onPress }: { rank: number; label: string; value: string; ratio: number; color: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={{ gap: 4, paddingVertical: 5 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={[s.rankNo, rank === 1 && { backgroundColor: c.dangerSoft }]}><Text style={[s.mono, { fontSize: 10, fontWeight: '600', color: rank === 1 ? c.dangerText : c.muted }]}>{rank}</Text></View>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '500', color: c.text }} numberOfLines={1}>{label}</Text>
        <Text style={[s.mono, { fontSize: 13, fontWeight: '600', color }]}>{value}</Text>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: c.hairline }}><View style={{ width: `${Math.max(4, ratio * 100)}%`, height: 4, borderRadius: 2, backgroundColor: color }} /></View>
    </Pressable>
  )
}

// List row inside an ACard: icon box, title/subtitle, right slot.
export function ARow({ icon, iconTone = 'blue', title, subtitle, right, onPress, last, testID }: {
  icon?: SfName; iconTone?: ATone; title: ReactNode; subtitle?: ReactNode; right?: ReactNode; onPress?: () => void; last?: boolean; testID?: string
}) {
  const t = TONE[iconTone]
  const body = (
    <>
      {icon ? <View style={[s.rowIcon, { backgroundColor: t.bg }]}><Icon name={icon} size={17} color={iconTone === 'blue' ? c.primary : t.fg} /></View> : null}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        {typeof title === 'string' ? <Text style={s.rowTitle} numberOfLines={1}>{title}</Text> : title}
        {typeof subtitle === 'string' ? <Text style={s.rowSub} numberOfLines={1}>{subtitle}</Text> : subtitle}
      </View>
      {right}
      {onPress ? <Icon name="chevron.right" size={12} color={c.ghost} /> : null}
    </>
  )
  const style = [s.row, last && { borderBottomWidth: 0 }]
  if (!onPress) return <View testID={testID} style={style}>{body}</View>
  return <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [style, pressed && { backgroundColor: c.bg }]}>{body}</Pressable>
}

export function KV({ label, value, last, right }: { label: string; value: ReactNode; last?: boolean; right?: boolean }) {
  return (
    <View style={[s.kv, right && { borderRightWidth: 0 }, last && { borderBottomWidth: 0 }]}>
      <Text style={s.kvLabel}>{label}</Text>
      {typeof value === 'string' ? <Text style={s.kvValue} numberOfLines={2}>{value}</Text> : value}
    </View>
  )
}

export function StatTile({ label, value, color, onPress }: { label: string; value: string; color?: string; onPress?: () => void }) {
  return (
    <ACard onPress={onPress} style={{ flex: 1, padding: 10, gap: 2, borderRadius: 10 }}>
      <Text style={{ fontSize: 10.5, color: c.faint, fontWeight: '500' }} numberOfLines={1}>{label}</Text>
      <Text style={[s.mono, { fontSize: 19, fontWeight: '600', color: color || c.text }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </ACard>
  )
}

export function DayHeader({ title, right }: { title: string; right?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2, paddingTop: 10, paddingBottom: 6 }}>
      <Text style={s.dayTitle}>{title}</Text>
      <View style={{ flex: 1 }} />
      {right ? <Text style={[s.mono, { fontSize: 11, color: c.ghost }]}>{right}</Text> : null}
    </View>
  )
}

const s = StyleSheet.create({
  mono: { fontVariant: ['tabular-nums'], fontFamily: 'Menlo' },
  header: { backgroundColor: c.card, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  eyebrow: { fontSize: 10, letterSpacing: 0.8, color: c.faint, fontFamily: 'Menlo' },
  title: { fontSize: 22, fontWeight: '700', color: c.text, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, color: c.faint, marginTop: 1 },
  iconBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: c.border, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnPrimary: { backgroundColor: c.primary, borderColor: c.primary },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 36, paddingHorizontal: 12, borderWidth: 1, borderColor: c.border, borderRadius: 8, backgroundColor: c.bg },
  stripItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stripSep: { width: 1, height: 16, backgroundColor: c.border, marginRight: 4 },
  stripLabel: { fontSize: 12, color: c.muted },
  stripValue: { fontSize: 12, fontWeight: '700', color: c.text },
  dot: { width: 7, height: 7, borderRadius: 4 },
  seg: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 9, backgroundColor: c.field },
  segBtn: { flex: 1, height: 28, borderRadius: 7, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: c.card, shadowColor: '#0f172a', shadowOpacity: 0.14, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  segText: { fontSize: 12, fontWeight: '600', color: c.muted },
  segTextOn: { color: c.text },
  card: { backgroundColor: c.card, borderWidth: 1, borderColor: c.border, borderRadius: 12, ...adminShadow },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, paddingBottom: 8 },
  secTitle: { fontSize: 14, fontWeight: '700', color: c.text },
  secSub: { fontSize: 11, color: c.faint, marginTop: 1 },
  link: { fontSize: 12, fontWeight: '600', color: c.primary },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 20, paddingHorizontal: 7, borderRadius: 4, alignSelf: 'flex-start' },
  tagDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.85 },
  tagText: { fontSize: 11, fontWeight: '600' },
  kpi: { padding: 12, gap: 6, flexGrow: 1, flexBasis: '46%' },
  kpiHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kpiLabel: { fontSize: 11.5, fontWeight: '500', color: c.faint },
  kpiMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  kpiValue: { fontSize: 24, fontWeight: '600', color: c.text, flexShrink: 1 },
  kpiNote: { fontSize: 11, color: c.ghost },
  segbar: { flexDirection: 'row', height: 5, borderRadius: 3, overflow: 'hidden', gap: 2, marginTop: 2 },
  tip: { position: 'absolute', top: 0, width: 120, marginLeft: -60, alignItems: 'center' },
  tipText: { backgroundColor: c.text, color: '#fff', fontSize: 11, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden', fontVariant: ['tabular-nums'] },
  tipArrow: { width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: c.text },
  rankNo: { width: 18, height: 18, borderRadius: 5, backgroundColor: c.hairline, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: c.hairline },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: c.text },
  rowSub: { fontSize: 11.5, color: c.faint },
  kv: { flex: 1, gap: 2, padding: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderRightWidth: 1, borderColor: '#eef2f6' },
  kvLabel: { fontSize: 10.5, color: c.faint, fontWeight: '500' },
  kvValue: { fontSize: 13.5, color: c.text, fontWeight: '600' },
  dayTitle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, color: c.faint, textTransform: 'uppercase' },
})
