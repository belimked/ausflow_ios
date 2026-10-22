import { LinearGradient } from 'expo-linear-gradient'
import * as SecureStore from 'expo-secure-store'
import { useEffect, useRef, useState, type ComponentRef } from 'react'
import { Alert, Image, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Button, Icon } from '@/components/ui'
import { forgotPassword } from '@/lib/api'
import { ENV_LABEL } from '@/lib/config'
import { useStore } from '@/lib/store'
import { colors, gradient, radius, shadow } from '@/lib/theme'

const REMEMBER_KEY = 'remember_username'

export default function Login() {
  const { signIn, error: storeError } = useStore()
  const insets = useSafeAreaInsets()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Old WasteID "Remember Me": keep the username (never the password) for the next sign-in.
  const [remember, setRemember] = useState(true)
  // "Next" on the username keyboard moves to the password field.
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null)

  useEffect(() => {
    SecureStore.getItemAsync(REMEMBER_KEY).catch(() => null).then((u) => { if (u) setUsername((cur) => cur || u) })
  }, [])

  async function submit() {
    if (!username.trim() || !password) return setError('Enter your username and password.')
    setBusy(true)
    setError(null)
    try {
      await signIn(username, password)
      if (remember) await SecureStore.setItemAsync(REMEMBER_KEY, username.trim()).catch(() => {})
      else await SecureStore.deleteItemAsync(REMEMBER_KEY).catch(() => {})
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // Old WasteID "Forgot Password?": the reset link is emailed and opened in the browser, then sign in here.
  function forgot() {
    Alert.prompt('Reset password', 'Enter your username or email address. A reset link will be sent to the email address on your account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send link', onPress: async (login?: string) => {
          if (!login?.trim()) return
          try {
            await forgotPassword(login.trim())
            Alert.alert('Check your email', 'If that account has an email address, a reset link is on its way. It works once, for one hour.')
          } catch (e) {
            Alert.alert('Could not send the link', (e as Error).message)
          }
        },
      },
    ], 'plain-text', username.trim())
  }

  const message = error || storeError

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }} bounces={false}>
        <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { paddingTop: insets.top + 48 }]}>
          <View style={s.logoWrap}>
            <Image source={require('../../assets/logo.png')} style={{ width: 56, height: 56 }} />
          </View>
          <Text style={s.brand}>AusFlow</Text>
          <Text style={s.tagline}>Liquid Trade Waste Services</Text>
          <View style={s.env}><Text style={s.envText}>{ENV_LABEL} environment</Text></View>
        </LinearGradient>

        <View style={s.card}>
          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to record grease trap pickups.</Text>

          <Text style={s.label}>Username</Text>
          <View style={s.field}>
            <Icon name="person" size={17} color={colors.faint} />
            <TextInput
              testID="login-username" value={username} onChangeText={setUsername} placeholder="e.g. ops01" placeholderTextColor={colors.faint}
              autoCapitalize="none" autoCorrect={false} textContentType="username" returnKeyType="next" style={s.input}
              submitBehavior="submit" onSubmitEditing={() => passwordRef.current?.focus()}
            />
          </View>

          <Text style={s.label}>Password</Text>
          <View style={s.field}>
            <Icon name="lock" size={17} color={colors.faint} />
            <TextInput
              testID="login-password" value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={colors.faint}
              // oneTimeCode keeps iOS from pairing this with the username and showing "Save Password?" after sign-in; that
              // system sheet covers the app and makes the UI test driver time out.
              ref={passwordRef} secureTextEntry={!show} textContentType="oneTimeCode" returnKeyType="go" onSubmitEditing={submit} style={s.input}
            />
            <Pressable hitSlop={10} onPress={() => setShow((v) => !v)}>
              <Icon name={show ? 'eye.slash' : 'eye'} size={17} color={colors.muted} />
            </Pressable>
          </View>

          <View style={s.remember}>
            <Text style={s.rememberText}>Remember my username</Text>
            <Switch testID="login-remember" value={remember} onValueChange={setRemember} trackColor={{ true: colors.primary }} />
          </View>

          {message ? (
            <View style={s.error}>
              <Icon name="exclamationmark.circle.fill" size={16} color={colors.danger} />
              <Text style={s.errorText}>{message}</Text>
            </View>
          ) : null}

          <Button testID="login-submit" title="Sign in" icon="arrow.right" onPress={submit} loading={busy} style={{ marginTop: 20 }} />
          <Pressable testID="login-forgot" onPress={forgot} hitSlop={8} style={s.forgot}>
            <Text style={s.forgotText}>Forgot password?</Text>
          </Pressable>
        </View>

        <Text style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>Use the same account as the AusFlow web console.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', paddingBottom: 72, paddingHorizontal: 24 },
  logoWrap: { width: 84, height: 84, borderRadius: 26, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...shadow, shadowOpacity: 0.2 },
  brand: { color: '#fff', fontSize: 34, fontWeight: '800', marginTop: 18, letterSpacing: -0.5 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 15, marginTop: 4 },
  env: { marginTop: 14, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.18)' },
  envText: { color: '#fff', fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  card: { marginTop: -44, marginHorizontal: 16, backgroundColor: colors.card, borderRadius: radius.xl, padding: 22, ...shadow, shadowOpacity: 0.1 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 15, color: colors.muted, marginTop: 4, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 14, marginBottom: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: radius.md, backgroundColor: colors.bg, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, fontSize: 17, color: colors.text, height: '100%' },
  forgot: { alignSelf: 'center', marginTop: 14 },
  forgotText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  remember: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  rememberText: { fontSize: 15, color: colors.text },
  error: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 14, padding: 12, borderRadius: radius.sm, backgroundColor: colors.dangerSoft },
  errorText: { flex: 1, color: colors.danger, fontSize: 14, fontWeight: '600' },
  footer: { textAlign: 'center', color: colors.faint, fontSize: 13, marginTop: 'auto', paddingTop: 24 },
})
