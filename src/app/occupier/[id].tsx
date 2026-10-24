import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo } from 'react'
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, ARow, IconButton, KV, SectionCard, StatTile, Tag } from '@/components/admin'
import { companyTypes, donePickupsSince, dueBuckets } from '@/lib/admin'
import { addressOf, dueState } from '@/lib/format'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

export default function OccupierScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const co = ix.companies.get(id)

  const v = useMemo(() => {
    if (!data) return null
    const devices = data.devices.filter((d) => d.ownerId === id)
    const ids = new Set(devices.map((d) => d.id))
    const locIds = [...new Set(devices.map((d) => d.locationId).filter(Boolean) as string[])]
    const locations = locIds.map((l) => ix.locations.get(l)).filter(Boolean).map((loc) => {
      const devs = devices.filter((d) => d.locationId === loc!.id)
      const worst = devs.map((d) => dueState(d)).sort((a, b) => a.days - b.days)[0]
      return { loc: loc!, devs, worst }
    })
    const b = dueBuckets(devices)
    const year = donePickupsSince(data.pickups.filter((p) => p.deviceId && ids.has(p.deviceId)), 365)
    const transport = [...new Set(devices.map((d) => d.companyId).filter(Boolean) as string[])].map((t) => ({ co: ix.companies.get(t), n: devices.filter((d) => d.companyId === t).length })).filter((x) => x.co)
    const issues = data.reportedIssues.filter((i) => i.status !== 'resolved' && ids.has(i.deviceId))
    return { devices, locations, b, year, transport, issues }
  }, [data, id, ix])

  if (!co || !v) return <View style={{ flex: 1, backgroundColor: c.bg }}><Stack.Screen options={{ headerShown: false }} /><AHeader title="Occupier" back={() => router.back()} /><Text style={s.empty}>Not found.</Text></View>
  const TONE = { overdue: 'rose', soon: 'amber', ok: 'green', unknown: 'slate' } as const

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow={`OCCUPIER · ${co.id}`} title={co.name} back={() => router.back()}
        right={co.phone ? <IconButton name="phone.fill" label="Call" onPress={() => Linking.openURL(`tel:${co.phone}`)} /> : undefined}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <Tag label={co.status || 'Active'} tone={co.status === 'Active' || !co.status ? 'green' : 'slate'} />
          {companyTypes(co).filter((t) => t !== 'occupier').map((t) => <Tag key={t} label={t.replace('_', ' ')} tone="slate" />)}
        </View>
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <StatTile label="Locations" value={String(v.locations.length)} />
          <StatTile label="Devices" value={String(v.devices.length)} />
          <StatTile label="Overdue" value={String(v.b.overdue)} color={v.b.overdue ? c.dangerText : undefined} />
          <StatTile label="Pump-outs 12 mo" value={String(v.year.length)} />
        </View>
        <ACard>
          <View style={{ flexDirection: 'row' }}>
            <KV label="Phone" value={co.phone || '—'} last />
            <KV label="Company ID" value={<Text style={s.mono}>{co.id}</Text>} right last />
          </View>
        </ACard>
        <SectionCard title="Locations" sub="devices · status">
          {v.locations.length ? v.locations.map(({ loc, devs, worst }, i) => (
            <ARow key={loc.id} icon="mappin.and.ellipse" iconTone={TONE[worst?.state || 'unknown']} title={loc.name} subtitle={`${addressOf(loc) || loc.id} · ${devs.length} device${devs.length === 1 ? '' : 's'}`}
              right={worst ? <Tag label={worst.label} tone={TONE[worst.state]} /> : undefined} last={i === v.locations.length - 1} onPress={() => router.push(`/location/${loc.id}`)} />
          )) : <Text style={s.empty}>No locations linked to this occupier yet.</Text>}
        </SectionCard>
        <SectionCard title="Transport companies serving">
          {v.transport.length ? v.transport.map(({ co: t, n }, i) => <ARow key={t!.id} icon="building.2.fill" title={t!.name} subtitle={`${n} device${n === 1 ? '' : 's'}`} last={i === v.transport.length - 1} onPress={() => router.push(`/company/${t!.id}`)} />)
            : <Text style={s.empty}>None assigned.</Text>}
        </SectionCard>
        {v.issues.length ? (
          <SectionCard title="Open problems" sub="Reported by drivers">
            {v.issues.map((i, n) => <ARow key={i.id} icon="exclamationmark.bubble.fill" iconTone="amber" title={i.category.replace(/_/g, ' ')} subtitle={i.description || ix.devices.get(i.deviceId)?.ref} last={n === v.issues.length - 1} onPress={() => router.push(`/device/${i.deviceId}`)} />)}
          </SectionCard>
        ) : null}
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  mono: { fontFamily: 'Menlo', fontSize: 12.5, color: c.text, fontWeight: '600' },
  empty: { fontSize: 13, color: c.faint, padding: 14, textAlign: 'center' },
})
