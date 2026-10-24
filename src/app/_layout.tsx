import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StoreProvider, useStore } from '@/lib/store'
import { TrailerProvider } from '@/lib/trailers'
import { colors } from '@/lib/theme'

function RootStack() {
  const { ready, session, viewMode } = useStore()
  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary }}>
        <ActivityIndicator color="#fff" />
      </View>
    )
  }
  const signedIn = !!session
  const console = signedIn && viewMode === 'admin'
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
      <Stack.Protected guard={signedIn && !console}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={console}>
        <Stack.Screen name="(admin)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="scan" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="setup" options={{ title: 'Driver & vehicle', presentation: 'modal' }} />
        <Stack.Screen name="device/[id]" options={{ title: 'Device' }} />
        <Stack.Screen name="job/[id]" options={{ title: 'Pickup' }} />
        <Stack.Screen name="issue/[deviceId]" options={{ title: 'Report a problem', presentation: 'modal' }} />
        <Stack.Screen name="offload" options={{ title: 'Offload waste' }} />
        <Stack.Screen name="transfer" options={{ title: 'Transfer to another truck' }} />
        <Stack.Screen name="vehicle" options={{ title: 'On board' }} />
        <Stack.Screen name="details" options={{ title: 'My details', presentation: 'modal' }} />
        <Stack.Screen name="directory" options={{ headerShown: false }} />
        <Stack.Screen name="company/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="driver/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="vehicle/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="location/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="occupier/[id]" options={{ headerShown: false }} />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <TrailerProvider>
          <StatusBar style="dark" />
          <RootStack />
        </TrailerProvider>
      </StoreProvider>
    </SafeAreaProvider>
  )
}
