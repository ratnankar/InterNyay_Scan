import { StyleSheet } from 'react-native'

export const colors = {
  paper: '#F4F6F8',
  surface: '#FFFFFF',
  ink: '#14202E',
  inkSoft: '#4A5868',
  inkFaint: '#5F6B78',
  line: '#DCE2E8',
  bar: '#1D4E89',
  barDeep: '#123A68',
  barTint: '#E6EEF7',
  seal: '#A82B26',
  sealTint: '#F8E5E3',
  ok: '#256A4B',
  okTint: '#E2F1EA',
  ochre: '#8A5A12',
  ochreTint: '#F7EBD6',
  scrim: 'rgba(20,32,46,0.45)',
  white: '#FFFFFF',
  onBar: 'rgba(255,255,255,0.78)',
  onBarTint: 'rgba(255,255,255,0.16)',
  focus: '#2F6FB5',
}

export const fonts = {
  serif: 'SourceSerif4_600SemiBold',
  serifBold: 'SourceSerif4_700Bold',
  sans: 'IBMPlexSans_400Regular',
  sansMedium: 'IBMPlexSans_500Medium',
  sansSemi: 'IBMPlexSans_600SemiBold',
}

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }

export const hit = 44

export const shadow = {
  card: { shadowColor: '#14202E', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  lift: { shadowColor: '#14202E', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
}

export const radius = { sm: 8, md: 12, lg: 18, pill: 999 }

export const type = StyleSheet.create({
  display: { fontFamily: fonts.serifBold, fontSize: 30, lineHeight: 36, color: colors.ink },
  title: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 28, color: colors.ink },
  heading: { fontFamily: fonts.sansSemi, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.ink },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.inkSoft },
  label: { fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18, color: colors.inkSoft },
})
