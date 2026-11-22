import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, View } from 'react-native'
import { colors, shadow } from '@/theme'
import { tap } from '@/utils/haptics'

export function Seal({
  size = 64,
  onPress,
  label,
  tone = 'dark',
}: {
  size?: number
  onPress?: () => void
  label: string
  tone?: 'dark' | 'light'
}) {
  const inner = size - 14
  const light = tone === 'light'
  const mark = (
    <View
      style={[
        styles.outer,
        light ? styles.outerLight : styles.outerDark,
        { width: size, height: size, borderRadius: size / 2 },
        !light && onPress ? shadow.lift : null,
      ]}
    >
      <View
        style={[
          styles.ring,
          light ? styles.ringLight : styles.ringDark,
          { width: inner, height: inner, borderRadius: inner / 2 },
        ]}
      >
        <Feather name="camera" size={size * 0.38} color={light ? colors.barDeep : colors.white} />
      </View>
    </View>
  )
  if (!onPress) {
    return (
      <View accessibilityRole="image" accessibilityLabel={label}>
        {mark}
      </View>
    )
  }
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {mark}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  outer: { alignItems: 'center', justifyContent: 'center' },
  outerDark: { backgroundColor: colors.barDeep },
  outerLight: { backgroundColor: 'rgba(255,255,255,0.22)' },
  ring: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  ringDark: { borderColor: 'rgba(255,255,255,0.55)', backgroundColor: colors.bar },
  ringLight: { borderColor: colors.white, backgroundColor: colors.white },
  pressed: { opacity: 0.85, transform: [{ scale: 0.97 }] },
})
