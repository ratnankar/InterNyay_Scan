import { Feather } from '@expo/vector-icons'
import { Tabs } from 'expo-router'
import type { ComponentProps } from 'react'
import { Platform, StyleSheet, View, type ColorValue } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Seal } from '@/components/Seal'
import { startScan } from '@/pipeline/useScanFlow'
import { colors, fonts } from '@/theme'
import { usePendingRows } from '@/upload/usePending'

type IconName = ComponentProps<typeof Feather>['name']

const icon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Feather name={name} size={size} color={color as string} />

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const { waiting } = usePendingRows()
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 0)

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.bar,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarLabelStyle: { fontFamily: fonts.sansMedium, fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          height: 56 + bottom,
          paddingBottom: bottom,
          paddingTop: 6,
        },
        tabBarBadgeStyle: { backgroundColor: colors.ochre, color: colors.white, fontFamily: fonts.sansSemi, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: icon('home') }} />
      <Tabs.Screen
        name="scans"
        options={{
          title: 'My Scans',
          tabBarIcon: icon('layers'),
          tabBarBadge: waiting.length > 0 ? waiting.length : undefined,
          tabBarAccessibilityLabel: waiting.length > 0 ? `My Scans, ${waiting.length} waiting to upload` : 'My Scans',
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarButton: () => (
            <View style={styles.slot}>
              <Seal size={62} label="Scan document" onPress={() => void startScan()} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="documents" options={{ title: 'Documents', tabBarIcon: icon('folder') }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: icon('user') }} />
    </Tabs>
  )
}

const styles = StyleSheet.create({
  slot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', marginTop: -22 },
})
