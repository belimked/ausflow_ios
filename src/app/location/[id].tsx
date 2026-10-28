import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, IconButton, KV, LinkText, SectionCard, Tag } from '@/components/admin'
import { donePickupsSince, litresOf, sortByDue } from '@/lib/admin'
import { addressOf, dueState, fmtL } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

const TONE = { overdue: 'rose', soon: 'amber', ok: 'green', unknown: 'slate' } as const

export default function LocationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const loc = ix.locations.get(id)

  const v = useMemo(() => {
    if (!data) return null
    const devices = sortByDue(data.devices.filter((d) => d.locationId === id))
    const ids = new Set(devices.map((d) => d.id))
    const year = donePickupsSince(data.pickups.filter((p) => p.deviceId && ids.has(p.deviceId)), 365)
    const overdue = devices.filter((d) => dueState(d).state === 'overdue').length
    const owners = [...new Set(devices.map((d) => d.ownerId).filter(Boolean) as string[])].map((o) => ix.companies.get(o)).filter(Boolean)
    const transport = [...new Set(devices.map((d) => ix.servicedBy.get(d.id)).filter(Boolean) as string[])].map((o) => ix.companies.get(o)).filter(Boolean)
    return { devices, year, overdue, owners, transport }
  }, [data, id, ix])

  if (!loc || !v) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Location" back={() => router.back()} /><Text style={s.empty}>Not found.</Text></View>
  const address = addressOf(loc)
  const coords = v.devices.find((d) => d.lat != null && d.lng != null)
  const lat = loc.lat ?? coords?.lat, lng = loc.lng ?? coords?.lng

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow={`${loc.id} · LOCATION`} title={loc.name} subtitle={address || undefined} back={() => router.back()}
        right={lat != null && lng != null ? <IconButton name="map.fill" label="Show on map" onPress={() => router.push({ pathname: '/map', params: { locationId: loc.id } })} /> : undefined}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {v.overdue ? <Tag label={`${v.overdue} overdue`} tone="rose" /> : <Tag label="Nothing overdue" tone="green" />}
          <Tag label={loc.status || 'Active'} tone={loc.status === 'Active' || !loc.status ? 'green' : 'slate'} />
          {loc.postcode ? <Tag label={`${loc.state || ''} ${loc.postcode}`.trim()} tone="slate" /> : null}
        </View>
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        <ACard>
          <View style={{ flexDirection: 'row' }}>
            <KV label="Occupier" value={v.owners.length ? <LinkText label={v.owners.map((o) => o!.name).join(', ')} onPress={() => router.push(`/occupier/${v.owners[0]!.id}`)} /> : '—'} />
            <KV label="Agreement" value={loc.agreementNo || '—'} right />
          </View>
          <View style={{ flexDirection: 'row' }}>
            <KV label="Devices" value={String(v.devices.length)} last />
            <KV label="Pump-outs · 12 mo" value={`${v.year.length} · ${fmtL(litresOf(v.year))}`} right last />
          </View>
        </ACard>

        <SectionCard title="Devices at this location" right={<LinkText label="Filter list" onPress={() => router.navigate('/devices')} />}>
          {v.devices.length ? v.devices.map((d, i) => {
            const due = dueState(d)
            const co = ix.servicedBy.get(d.id) ? ix.companies.get(ix.servicedBy.get(d.id)!) : undefined
            return <ARow key={d.id} icon="drop.fill" iconTone={TONE[due.state]} title={<Text style={s.title}><Text style={s.mono}>{d.ref}</Text>{d.type ? ` · ${d.type}` : ''}</Text>}
              subtitle={[d.capacity ? fmtL(d.capacity) : null, d.freqWeeks ? `every ${d.freqWeeks} wk` : null, co?.name].filter(Boolean).join(' · ')}
              right={<Tag label={due.label} tone={TONE[due.state]} />} last={i === v.devices.length - 1} onPress={() => router.push(`/device/${d.id}`)} />
          }) : <Text style={s.empty}>No devices here.</Text>}
        </SectionCard>

        {v.devices.some((d) => d.locationDesc || d.comments) ? (
          <SectionCard title="Notes">
            <View style={{ paddingHorizontal: 14, paddingBottom: 12, gap: 8 }}>
              {v.devices.filter((d) => d.locationDesc || d.comments).map((d) => (
                <Text key={d.id} style={s.note}><Text style={s.mono}>{d.ref}</Text> · {[d.locationDesc, d.comments].filter(Boolean).join(' — ')}</Text>
              ))}
            </View>
          </SectionCard>
        ) : null}

        <SectionCard title="Transport companies serving">
          {v.transport.length ? v.transport.map((co, i) => <ARow key={co!.id} icon="building.2.fill" title={co!.name} subtitle={`${v.devices.filter((d) => ix.servicedBy.get(d.id) === co!.id).length} device(s)`} last={i === v.transport.length - 1} onPress={() => router.push(`/company/${co!.id}`)} />)
            : <Text style={s.empty}>No company has serviced these devices yet.</Text>}
        </SectionCard>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  title: { fontSize: 14, fontWeight: '600', color: c.text },
  mono: { fontFamily: 'Menlo', color: c.primary, fontSize: 12.5 },
  note: { fontSize: 13, lineHeight: 18, color: c.body },
  empty: { fontSize: 13, color: c.faint, padding: 14, textAlign: 'center' },
})
