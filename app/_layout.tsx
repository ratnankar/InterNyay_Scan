import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans'
import { SourceSerif4_600SemiBold, SourceSerif4_700Bold } from '@expo-google-fonts/source-serif-4'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { queryClient } from '@/api/queryClient'
import { useDraft } from '@/store/draft'
import { useSession } from '@/store/session'
import { useSettings } from '@/store/settings'
import { colors } from '@/theme'
import { startupCleanup } from '@/upload/pending'

void SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
  })
  const status = useSession((s) => s.status)

  useEffect(() => {
    void (async () => {
      try {
        await startupCleanup()
      } catch {
        return
      }
    })()
    void useSettings.getState().load()
    void useSession.getState().restore()
  }, [])

  useEffect(() => {
    if (status === 'signedOut') {
      queryClient.clear()
      useDraft.getState().reset()
    }
  }, [status])

  useEffect(() => {
    if (fontsLoaded && status !== 'loading') void SplashScreen.hideAsync()
  }, [fontsLoaded, status])

  if (!fontsLoaded || status === 'loading') return null

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Protected guard={status === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="edit" options={{ gestureEnabled: false }} />
          <Stack.Screen name="crop" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="annotate" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="resize" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="review" options={{ gestureEnabled: false }} />
          <Stack.Screen name="text" />
          <Stack.Screen name="pdf" />
          <Stack.Screen name="folder" />
        </Stack.Protected>
        <Stack.Protected guard={status === 'signedOut'}>
          <Stack.Screen name="(auth)/login" />
        </Stack.Protected>
      </Stack>
    </QueryClientProvider>
  )
}
