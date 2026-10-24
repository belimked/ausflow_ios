import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Icon } from '@/components/ui'
import * as api from '@/lib/api'
import { fmtDateTime } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import type { Photo } from '@/lib/types'

const KIND: Record<string, string> = { pickupAfter: 'After pump-out', pickupBefore: 'Before pump-out', issue: 'Reported problem', device: 'Device', photo: 'Photo' }

// Full-screen viewer for the photos stored against records (/photos): `ids` is a comma-separated list of
// "type:id" pairs, e.g. pickup:PK0001,issue:RI0002.
export default function Photos() {
  const { ids, title } = useLocalSearchParams<{ ids: string; title?: string }>()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { session, canWrite } = useStore()
  const ix = useIndex()
  const [photos, setPhotos] = useState<Photo[] | null>(null)
  const [i, setI] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!session) return
    const pairs = (ids || '').split(',').map((p) => p.split(':')).filter((p) => p.length === 2)
    try {
      const lists = await Promise.all(pairs.map(([type, id]) => api.listPhotos(session.token, type, id).catch(() => [] as Photo[])))
      const all = lists.flat().sort((a, b) => (b.at || '').localeCompare(a.at || ''))
      setPhotos(all); setError(null)
    } catch (e) { setError((e as Error).message) }
  }, [session, ids])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const p = photos?.[i]
  const pickup = p?.entityType === 'pickup' ? ix.pickups.get(p.entityId) : undefined
  const device = pickup?.deviceId ? ix.devices.get(pickup.deviceId) : undefined

  function remove() {
    if (!p || !session) return
    Alert.alert('Delete this photo?', 'It is removed from the server for everyone. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.deletePhoto(session.token, p.id); setI(0); await load() } catch (e) { Alert.alert('Could not delete', (e as Error).message) } } },
    ])
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 6 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={s.bar}>
        <Pressable onPress={() => router.back()} style={s.ibtn} accessibilityLabel="Close"><Icon name="xmark" size={18} color="#fff" /></Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.title} numberOfLines={1}>{p ? KIND[p.kind] || p.kind : title || 'Photos'}</Text>
          <Text style={s.sub} numberOfLines={1}>{photos ? `${photos.length ? i + 1 : 0} of ${photos.length}` : 'Loading…'}{title ? ` · ${title}` : ''}</Text>
        </View>
        {p ? <Pressable onPress={() => Share.share({ url: p.dataUrl, title: p.name || p.kind })} style={s.ibtn} accessibilityLabel="Share"><Icon name="square.and.arrow.up" size={18} color="#fff" /></Pressable> : null}
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {p ? <Image source={{ uri: p.dataUrl }} style={{ width: '100%', aspectRatio: 3 / 4, maxHeight: '100%' }} resizeMode="contain" />
          : <Text style={s.empty}>{error || (photos ? 'No photos stored for this record.' : '')}</Text>}
      </View>
      {photos && photos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }} style={{ flexGrow: 0, marginBottom: 12 }}>
          {photos.map((ph, n) => (
            <Pressable key={ph.id} onPress={() => setI(n)} style={[s.thumb, n === i && s.thumbOn]}><Image source={{ uri: ph.dataUrl }} style={{ width: 56, height: 56, borderRadius: 6 }} /></Pressable>
          ))}
        </ScrollView>
      ) : null}
      {p ? (
        <View style={[s.meta, { paddingBottom: insets.bottom + 12 }]}>
          <View style={s.grid}>
            <KV label="Kind" value={KIND[p.kind] || p.kind} />
            <KV label="Taken by" value={p.user || '—'} />
            <KV label="When" value={fmtDateTime(p.at)} />
            <KV label="Record" value={`${p.entityType} ${p.entityId}`} />
            {device ? <KV label="Device" value={device.ref} /> : null}
            {pickup?.endLat != null ? <KV label="GPS" value={`${pickup.endLat.toFixed(4)}, ${pickup.endLng?.toFixed(4)}`} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {pickup ? <Text onPress={() => router.push(`/job/${pickup.id}`)} style={s.action}>Open pickup</Text> : null}
            {device ? <Text onPress={() => router.push({ pathname: '/map', params: { deviceId: device.id } })} style={s.action}>Show on map</Text> : null}
            {canWrite ? <Text onPress={remove} style={[s.action, s.danger]}>Delete</Text> : null}
          </View>
        </View>
      ) : null}
    </View>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return <View style={{ width: '48%', gap: 2 }}><Text style={s.kvl}>{label}</Text><Text style={s.kvv} numberOfLines={1}>{value}</Text></View>
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f172a' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 48 },
  ibtn: { width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,.12)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#f1f5f9', fontSize: 15, fontWeight: '700' },
  sub: { color: '#94a3b8', fontSize: 11, fontFamily: 'Menlo' },
  empty: { color: '#94a3b8', textAlign: 'center', fontSize: 13, padding: 24 },
  thumb: { borderRadius: 8, borderWidth: 2, borderColor: 'transparent', padding: 1 },
  thumbOn: { borderColor: '#7dd3fc' },
  meta: { margin: 16, marginTop: 0, padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,.08)', gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  kvl: { fontSize: 10.5, color: '#94a3b8', fontWeight: '500' },
  kvv: { fontSize: 12.5, color: '#f1f5f9', fontWeight: '600' },
  action: { flex: 1, height: 38, lineHeight: 38, textAlign: 'center', borderRadius: 9, backgroundColor: 'rgba(255,255,255,.12)', color: '#fff', fontSize: 12.5, fontWeight: '500', overflow: 'hidden' },
  danger: { backgroundColor: 'rgba(225,29,72,.22)', color: '#fecdd3' },
})
