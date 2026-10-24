import { useMemo } from 'react'
import { View } from 'react-native'
import { qrRuns } from '@/lib/qr'

export function QrCode({ value, size = 120, color = '#0f172a', quiet = 2 }: { value: string; size?: number; color?: string; quiet?: number }) {
  const q = useMemo(() => qrRuns(value), [value])
  const cell = size / (q.size + quiet * 2)
  const pad = cell * quiet
  return (
    <View style={{ width: size, height: size, backgroundColor: '#fff' }} accessibilityRole="image" accessibilityLabel={`QR code ${value}`}>
      {q.rows.map((r, i) => (
        <View key={i} style={{ position: 'absolute', left: pad + r.x * cell, top: pad + r.y * cell, width: r.w * cell + 0.3, height: cell + 0.3, backgroundColor: color }} />
      ))}
    </View>
  )
}
