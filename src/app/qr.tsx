import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { ACard, AHeader, IconButton, SectionCard, Segmented, Tag } from '@/components/admin'
import { QrCode } from '@/components/QrCode'
import { Icon } from '@/components/ui'
import { addressOf, fmtL } from '@/lib/format'
import { codeFor } from '@/lib/qr'
import { useIndex, useStore } from '@/lib/store'
import { admin as c } from '@/lib/theme'

type Kind = 'device' | 'vehicle' | 'driver'

// Identity codes: the device label (what drivers scan to start a pickup), the vehicle sticker (scanned at shift
// start to pick the truck) and a driver badge. Device and vehicle codes are exactly what lib/codes.ts resolves,
// so a label printed from here works with the scanner. Driver codes are not on the backend yet.
export default function QrScreen() {
  const params = useLocalSearchParams<{ kind?: Kind; id?: string }>()
  const router = useRouter()
  const { data } = useStore()
  const ix = useIndex()
  const [kind, setKind] = useState<Kind>(params.kind || 'device')
  const device = ix.devices.get(params.id || '') || (data?.devices || [])[0]
  const vehicle = ix.vehicles.get(params.id || '') || (data?.vehicles || [])[0]
  const driver = ix.drivers.get(params.id || '') || (data?.drivers || [])[0]
  const loc = device?.locationId ? ix.locations.get(device.locationId) : undefined
  const share = (text: string, subject: string) => Share.share({ message: text, title: subject })

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <AHeader eyebrow="IDENTITY" title="QR codes & labels" back={() => router.back()} right={<IconButton name="qrcode.viewfinder" label="Scan" primary onPress={() => router.push('/scan')} />}>
        <Segmented options={[{ key: 'device', label: 'Device label' }, { key: 'vehicle', label: 'Vehicle sticker' }, { key: 'driver', label: 'Driver badge' }] as { key: Kind; label: string }[]} value={kind} onChange={setKind} />
      </AHeader>
      <ScrollView contentContainerStyle={s.body}>
        {kind === 'device' && device ? (
          <SectionCard title="Device label · 60 × 40 mm" sub="Scan with the AusFlow app to record a pump-out" right={<Tag label={device.qr ? 'QR on file' : 'Uses device ref'} tone={device.qr ? 'green' : 'amber'} />}>
            <View style={s.labelWrap}>
              <View style={s.label}>
                <QrCode value={codeFor.device(device)} size={104} />
                <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Icon name="drop.fill" size={12} color={c.primary} /><Text style={s.brand}>AusFlow</Text><Text style={s.kind}>GREASE TRAP</Text></View>
                  <Text style={s.code}>{device.ref}</Text>
                  <Text style={s.line} numberOfLines={2}>{loc?.name || device.aka || ''}{loc ? ` · ${addressOf(loc)}` : ''}</Text>
                  <Text style={s.line}>{[device.capacity ? fmtL(device.capacity) : null, device.freqWeeks ? `every ${device.freqWeeks} weeks` : null].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
            </View>
            <Actions onShare={() => share(`AusFlow device ${device.ref}\nCode: ${codeFor.device(device)}\n${loc?.name || ''} ${addressOf(loc) || ''}`, `Device label ${device.ref}`)} />
            <Text style={s.note}>Encodes “{codeFor.device(device)}”. Printing to a label printer (AirPrint) is the next step; for now share the label text or screenshot it.</Text>
          </SectionCard>
        ) : null}
        {kind === 'vehicle' && vehicle ? (
          <SectionCard title="Vehicle sticker · windscreen" sub="Driver scans at shift start to select this vehicle" right={<Tag label={vehicle.qr ? 'QR on file' : 'Uses vehicle id'} tone={vehicle.qr ? 'green' : 'amber'} />}>
            <View style={s.labelWrap}>
              <View style={[s.label, { backgroundColor: '#0f172a', borderColor: '#0f172a' }]}>
                <QrCode value={codeFor.vehicle(vehicle)} size={104} />
                <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
                  <Text style={[s.kind, { color: '#94a3b8' }]}>AUSFLOW · VEHICLE</Text>
                  <Text style={[s.code, { color: '#fff', fontSize: 24 }]}>{vehicle.plate}</Text>
                  <Text style={[s.line, { color: '#cbd5e1' }]} numberOfLines={2}>{[ix.companies.get(vehicle.companyId || '')?.name, vehicle.type, vehicle.tank ? fmtL(vehicle.tank) : null].filter(Boolean).join(' · ')}</Text>
                </View>
              </View>
            </View>
            <Actions onShare={() => share(`AusFlow vehicle ${vehicle.plate}\nCode: ${codeFor.vehicle(vehicle)}`, `Vehicle sticker ${vehicle.plate}`)} />
            <Text style={s.note}>Encodes “{codeFor.vehicle(vehicle)}”.</Text>
          </SectionCard>
        ) : null}
        {kind === 'driver' && driver ? (
          <SectionCard title="Driver badge" sub="For facility gates to log an unload against the driver" right={<Tag label="Preview" tone="amber" />}>
            <View style={s.labelWrap}>
              <View style={[s.label, { backgroundColor: c.primaryTint }]}>
                <View style={{ alignItems: 'center', gap: 6 }}>
                  <View style={s.avatar}><Text style={s.avatarText}>{driver.name.split(' ').map((x) => x[0]).join('').slice(0, 2).toUpperCase()}</Text></View>
                  <QrCode value={codeFor.driver(driver)} size={72} />
                </View>
                <View style={{ flex: 1, gap: 3, justifyContent: 'center' }}>
                  <Text style={s.kind}>AUSFLOW · DRIVER</Text>
                  <Text style={[s.code, { fontSize: 18 }]}>{driver.name}</Text>
                  <Text style={s.line}>{[ix.companies.get(driver.companyId || '')?.name, driver.phone].filter(Boolean).join(' · ')}</Text>
                  <Text style={[s.line, { fontFamily: 'Menlo' }]}>{codeFor.driver(driver)}</Text>
                </View>
              </View>
            </View>
            <Text style={s.note}>The scanner does not recognise driver badges yet: the backend has no driver code field. This preview shows what the badge would look like.</Text>
          </SectionCard>
        ) : null}
        {!device && !vehicle && !driver ? <ACard style={{ padding: 14 }}><Text style={s.note}>Nothing to show yet.</Text></ACard> : null}
      </ScrollView>
    </View>
  )
}

function Actions({ onShare }: { onShare: () => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 6 }}>
      <Text onPress={onShare} style={s.action}>Share label</Text>
    </View>
  )
}

const s = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  labelWrap: { paddingHorizontal: 14, paddingBottom: 12 },
  label: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, backgroundColor: '#fff' },
  brand: { fontSize: 12, fontWeight: '700', color: '#0c4a6e' },
  kind: { fontSize: 9, letterSpacing: 0.8, color: c.faint, fontFamily: 'Menlo' },
  code: { fontSize: 20, fontWeight: '700', color: c.text, fontFamily: 'Menlo', letterSpacing: 0.5 },
  line: { fontSize: 11, color: c.body, lineHeight: 15 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  action: { flex: 1, height: 36, lineHeight: 36, textAlign: 'center', borderRadius: 8, backgroundColor: c.field, color: c.primary, fontSize: 12.5, fontWeight: '500', overflow: 'hidden' },
  note: { fontSize: 11, color: c.faint, paddingHorizontal: 14, paddingBottom: 14, lineHeight: 15 },
})
