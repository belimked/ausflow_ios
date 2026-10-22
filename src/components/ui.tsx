import * as Haptics from 'expo-haptics'
import { SymbolView, type SymbolViewProps } from 'expo-symbols'
import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, radius, shadow } from '@/lib/theme'

type SfName = Extract<SymbolViewProps['name'], string>

export function Icon({ name, size = 20, color = colors.text, weight = 'semibold' }: { name: SfName; size?: number; color?: string; weight?: SymbolViewProps['weight'] }) {
  // Decorative: without this the symbol name ("person.fill", "Building") is read by VoiceOver and prefixed to every
  // button label, e.g. "person.fill, E2E Driver One, circle".
  return <SymbolView name={name} size={size} tintColor={color} weight={weight} style={{ width: size, height: size }} accessible={false} accessibilityElementsHidden />
}

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger'
const TONES: Record<Tone, { fg: string; bg: string }> = {
  neutral: { fg: colors.muted, bg: '#EEF2F6' },
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
}
export const toneColor = (t: Tone) => TONES[t]

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: SfName }) {
  const c = TONES[tone]
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      {icon ? <Icon name={icon} size={11} color={c.fg} weight="bold" /> : null}
      <Text style={[styles.pillText, { color: c.fg }]}>{label}</Text>
    </View>
  )
}

export function Card({ children, style, onPress, testID }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (!onPress) return <View testID={testID} style={[styles.card, style]}>{children}</View>
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  )
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success'
export function Button({ title, onPress, kind = 'primary', icon, loading, disabled, style, size = 'lg', testID }: {
  title: string; onPress: () => void; kind?: ButtonKind; icon?: SfName; loading?: boolean; disabled?: boolean
  style?: StyleProp<ViewStyle>; size?: 'lg' | 'md'; testID?: string
}) {
  const palette = {
    primary: { bg: colors.primary, fg: '#fff' },
    success: { bg: colors.success, fg: '#fff' },
    secondary: { bg: colors.primarySoft, fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    ghost: { bg: 'transparent', fg: colors.primary },
  }[kind]
  const off = disabled || loading
  return (
    <Pressable
      testID={testID}
      disabled={off}
      onPress={() => { Haptics.selectionAsync(); onPress() }}
      style={({ pressed }) => [
        styles.button, size === 'md' && styles.buttonMd, { backgroundColor: palette.bg },
        off && { opacity: 0.5 }, pressed && styles.pressed, style,
      ]}>
      {loading ? <ActivityIndicator color={palette.fg} /> : (
        <>
          {icon ? <Icon name={icon} size={size === 'lg' ? 19 : 16} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, size === 'md' && { fontSize: 15 }, { color: palette.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  )
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      <View style={{ flex: 1 }}>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      {right}
    </View>
  )
}

export function SectionTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      {right}
    </View>
  )
}

export function IconBadge({ name, tone = 'primary', size = 40 }: { name: SfName; tone?: Tone; size?: number }) {
  const c = TONES[tone]
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.32, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size * 0.46} color={c.fg} />
    </View>
  )
}

export function Row({ icon, tone, title, subtitle, right, onPress, chevron = !!onPress, testID }: {
  icon?: SfName; tone?: Tone; title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; chevron?: boolean; testID?: string
}) {
  const body = (
    <>
      {icon ? <IconBadge name={icon} tone={tone} size={38} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.rowSub} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron.right" size={13} color={colors.faint} /> : null}
    </>
  )
  if (!onPress) return <View testID={testID} style={styles.row}>{body}</View>
  return <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#F6F8FA' }]}>{body}</Pressable>
}

export const Divider = () => <View style={styles.divider} />

export function EmptyState({ icon, title, message, action }: { icon: SfName; title: string; message?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <IconBadge name={icon} tone="primary" size={64} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={styles.emptyMsg}>{message}</Text> : null}
      {action}
    </View>
  )
}

export function Stat({ label, value, icon, tone = 'primary' }: { label: string; value: string; icon: SfName; tone?: Tone }) {
  return (
    <Card style={styles.stat}>
      <IconBadge name={icon} tone={tone} size={32} />
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  )
}

export function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: SfName }) {
  return (
    <Pressable onPress={() => { Haptics.selectionAsync(); onPress() }}
      style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
      {icon ? <Icon name={icon} size={12} color={active ? '#fff' : colors.muted} /> : null}
      <Text style={[styles.chipText, active && { color: '#fff' }]}>{label}</Text>
    </Pressable>
  )
}

export const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, ...shadow },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  button: { height: 54, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  buttonMd: { height: 44, borderRadius: 12 },
  buttonText: { fontSize: 17, fontWeight: '700' },
  header: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10, paddingHorizontal: 4 },
  section: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 64 },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32, gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 6, textAlign: 'center' },
  emptyMsg: { fontSize: 15, color: colors.muted, textAlign: 'center', lineHeight: 21 },
  stat: { flex: 1, padding: 14, gap: 6 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 4 },
  statLabel: { fontSize: 12, fontWeight: '600', color: colors.muted },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, height: 34, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.muted },
})
