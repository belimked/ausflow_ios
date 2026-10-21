import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider, useStore } from '@/lib/store'
import { colors } from '@/lib/theme'

function RootStack() {
  const { ready, session } = useStore()
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }
  const signedIn = !!session
  return (
    <Stack screenOptions={{
      headerTintColor: colors.primary,
      headerTitleStyle: { color: colors.text, fontWeight: '700' },
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.bg },
      contentStyle: { backgroundColor: colors.bg },
      headerBackButtonDisplayMode: 'minimal',
    }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="setup" options={{ title: 'Driver & vehicle', presentation: 'modal' }} />
        <Stack.Screen name="device/[id]" options={{ title: 'Device' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Pickup' }} />
        <Stack.Screen name="issue/[deviceId]" options={{ title: 'Report a problem', presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <StatusBar style="dark" />
        <RootStack />
      </StoreProvider>
    </SafeAreaProvider>
  )
}
