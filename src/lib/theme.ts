export const colors = {
  primary: '#0B5D8A',
  primaryBright: '#3FB1E3',
  primarySoft: '#E6F3FA',
  accent: '#2CC4A0',
  accentSoft: '#E3F7F1',
  bg: '#F2F5F8',
  card: '#FFFFFF',
  text: '#0F1B2A',
  muted: '#5B6B7C',
  faint: '#98A6B3',
  border: '#E3E8EE',
  danger: '#E5484D',
  dangerSoft: '#FDECEC',
  warning: '#D9822B',
  warningSoft: '#FDF1E3',
  success: '#1F9D7A',
  successSoft: '#E3F7F1',
}

export const radius = { sm: 10, md: 14, lg: 20, xl: 28 }

export const shadow = {
  shadowColor: '#0F1B2A',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
}

export const gradient = ['#0B5D8A', '#1688BF', '#3FB1E3'] as const

// Console (admin view) palette: the web console's layout D ("Stitch"), so admins see one product on desktop
// and phone. Driver screens keep `colors` above.
export const admin = {
  primary: '#0369a1',
  primaryDark: '#075985',
  primarySoft: '#e6f0f6',
  primaryTint: '#f0f9ff',
  bg: '#f8fafc',
  card: '#ffffff',
  border: '#e2e8f0',
  hairline: '#f1f5f9',
  field: '#eef1f5',
  text: '#0f172a',
  body: '#1e293b',
  muted: '#475569',
  faint: '#64748b',
  ghost: '#94a3b8',
  success: '#059669', successSoft: '#ecfdf5', successText: '#047854',
  warning: '#d97706', warningSoft: '#fffbeb', warningText: '#ae5f05',
  danger: '#e11d48', dangerSoft: '#fff1f2', dangerText: '#be123c',
  live: '#10b981',
}

export const adminShadow = {
  shadowColor: '#0f172a',
  shadowOpacity: 0.04,
  shadowRadius: 3,
  shadowOffset: { width: 0, height: 1 },
}
