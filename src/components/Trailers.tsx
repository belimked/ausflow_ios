import { ActionSheetIOS, Alert, StyleSheet, Text, View } from 'react-native'
import { fmtL } from '@/lib/format'
import { useTrailers } from '@/lib/trailers'
import { colors } from '@/lib/theme'
import { Card, Divider, Pill, Row } from './ui'

// DEMO ONLY: old WasteID "Attach Trailer / Dog". Nothing here is sent to the server.
export function TrailersCard() {
  const t = useTrailers()
  if (!t.enabled || !t.available.length) return null
  const free = t.available.filter((x) => !t.attached.some((a) => a.id === x.id))

  function attach() {
    if (!free.length) return
    ActionSheetIOS.showActionSheetWithOptions(
      { title: 'Attach a trailer (demo)', options: [...free.map((x) => `${x.plate} · ${fmtL(x.tank)}`), 'Cancel'], cancelButtonIndex: free.length },
      (i) => { if (i < free.length) t.attach(free[i].id) },
    )
  }

  function detach(id: string, plate: string) {
    const load = t.loads.get(id) || 0
    Alert.alert(`Detach ${plate}?`, load ? `${fmtL(load)} is recorded in this trailer. It stays with your truck's load until you offload.` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Detach', style: 'destructive', onPress: () => t.detach(id) },
    ])
  }

  return (
    <Card style={s.card}>
      <View style={s.head}>
        <Text style={s.label}>TRAILERS</Text>
        <Pill label="DEMO" tone="warning" />
      </View>
      {t.attached.map((x) => (
        <View key={x.id}>
          <Divider />
          <Row testID="trailer-attached" icon="link" tone="neutral" title={x.plate} subtitle={`${fmtL(t.loads.get(x.id) || 0)} of ${fmtL(x.tank)}`} onPress={() => detach(x.id, x.plate)} chevron={false} />
        </View>
      ))}
      {free.length ? (
        <>
          <Divider />
          <Row testID="trailer-attach" icon="plus.circle.fill" title="Attach trailer" subtitle="Demo data, not saved to the server" onPress={attach} />
        </>
      ) : null}
    </Card>
  )
}

const s = StyleSheet.create({
  card: { marginTop: 14, padding: 0, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6 },
})
