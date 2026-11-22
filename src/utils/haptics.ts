import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

const on = Platform.OS === 'ios' || Platform.OS === 'android'

export const tap = () => {
  if (on) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
}

export const success = () => {
  if (on) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
}

export const warn = () => {
  if (on) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined)
}
