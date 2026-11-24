import { Feather } from '@expo/vector-icons'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fonts, hit, radius, space, type } from '@/theme'
import { tap } from '@/utils/haptics'
import type { InputInstance } from '@/utils/refs'

type IconName = ComponentProps<typeof Feather>['name']

export function Screen({ children, edges = ['top'], style }: { children: ReactNode; edges?: ('top' | 'bottom')[]; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView edges={edges} style={[styles.screen, style]}>
      {children}
    </SafeAreaView>
  )
}

export function Header({
  title,
  onBack,
  right,
}: {
  title: string
  onBack?: () => void
  right?: ReactNode
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
          >
            <Feather name="chevron-left" size={26} color={colors.ink} />
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  )
}

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  loading,
  disabled,
  style,
}: {
  label: string
  onPress: () => void
  icon?: IconName
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  loading?: boolean
  disabled?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const off = disabled || loading
  return (
    <Pressable
      onPress={() => {
        if (variant === 'primary' || variant === 'danger') tap()
        onPress()
      }}
      disabled={off}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      style={({ pressed }) => [styles.button, buttonVariants[variant], off && styles.buttonOff, pressed && styles.buttonPressed, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.white : colors.bar} />
      ) : (
        <>
          {icon ? <Feather name={icon} size={18} color={buttonText[variant]} /> : null}
          <Text style={[styles.buttonLabel, { color: buttonText[variant] }]}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

const buttonVariants = StyleSheet.create({
  primary: { backgroundColor: colors.bar },
  secondary: { backgroundColor: colors.barTint },
  danger: { backgroundColor: colors.seal },
  ghost: { backgroundColor: 'transparent' },
})

const buttonText = {
  primary: colors.white,
  secondary: colors.barDeep,
  danger: colors.white,
  ghost: colors.bar,
}

export function Chip({
  label,
  active,
  onPress,
  icon,
  onClear,
}: {
  label: string
  active?: boolean
  onPress: () => void
  icon?: IconName
  onClear?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 5, bottom: 5 }}
      style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      {icon ? <Feather name={icon} size={14} color={active ? colors.white : colors.inkSoft} /> : null}
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]} numberOfLines={1}>
        {label}
      </Text>
      {active && onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Clear ${label} filter`}>
          <Feather name="x" size={14} color={colors.white} />
        </Pressable>
      ) : null}
    </Pressable>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={type.heading}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button" accessibilityLabel={`${action} ${title}`}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

export function Pill({ label, tone }: { label: string; tone: 'ok' | 'warn' | 'bad' | 'info' | 'mute' }) {
  const t = pillTones[tone]
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Text style={[styles.pillLabel, { color: t.fg }]}>{label}</Text>
    </View>
  )
}

const pillTones = {
  ok: { bg: colors.okTint, fg: colors.ok },
  warn: { bg: colors.ochreTint, fg: colors.ochre },
  bad: { bg: colors.sealTint, fg: colors.seal },
  info: { bg: colors.barTint, fg: colors.barDeep },
  mute: { bg: colors.paper, fg: colors.inkSoft },
}

export function ProgressBar({ fraction }: { fraction: number }) {
  const pct = Math.max(0, Math.min(1, fraction)) * 100
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: IconName
  title: string
  message?: string
  action?: string
  onAction?: () => void
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={26} color={colors.barDeep} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {message ? <Text style={[type.small, styles.emptyMessage]}>{message}</Text> : null}
      {action && onAction ? <Button label={action} variant="secondary" onPress={onAction} style={styles.emptyAction} /> : null}
    </View>
  )
}

export function ListLabel({ title, shown, total }: { title: string; shown: number; total: number }) {
  return (
    <View style={styles.listLabel}>
      <Text style={type.heading}>{title}</Text>
      <Text style={type.caption}>{shown < total ? `Showing ${shown} of ${total}` : `${total} total`}</Text>
    </View>
  )
}

export function Skeleton({ style }: { style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.55)).current
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null
    let alive = true
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive || reduced) return
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: 800, useNativeDriver: true }),
        ]),
      )
      loop.start()
    })
    return () => {
      alive = false
      loop?.stop()
    }
  }, [opacity])
  return <Animated.View style={[styles.skeleton, { opacity }, style]} />
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityRole="progressbar">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton style={styles.skeletonIcon} />
          <View style={styles.skeletonLines}>
            <Skeleton style={styles.skeletonLineA} />
            <Skeleton style={styles.skeletonLineB} />
          </View>
        </View>
      ))}
    </View>
  )
}

export function Banner({
  tone = 'bad',
  message,
  action,
  onAction,
}: {
  tone?: 'bad' | 'warn' | 'info'
  message: string
  action?: string
  onAction?: () => void
}) {
  const t = bannerTones[tone]
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]} accessibilityRole="alert">
      <Feather name={tone === 'info' ? 'info' : 'alert-circle'} size={18} color={t.fg} style={styles.bannerIcon} />
      <Text style={[styles.bannerText, { color: t.fg }]}>{message}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.bannerAction, { color: t.fg }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const bannerTones = {
  bad: { bg: colors.sealTint, fg: colors.seal },
  warn: { bg: colors.ochreTint, fg: colors.ochre },
  info: { bg: colors.barTint, fg: colors.barDeep },
}

export function Avatar({ label, size = 56 }: { label: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{label}</Text>
    </View>
  )
}

export function Field({
  label,
  error,
  hint,
  right,
  inputRef,
  ...props
}: TextInputProps & { label: string; error?: string | null; hint?: string; right?: ReactNode; inputRef?: Ref<InputInstance> }) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={styles.field}>
      <Text style={type.label}>{label}</Text>
      <View style={[styles.inputWrap, focused && styles.inputFocused, error ? styles.inputError : null, props.multiline && styles.inputMulti]}>
        <TextInput
          ref={inputRef}
          placeholderTextColor={colors.inkFaint}
          accessibilityLabel={label}
          {...props}
          onFocus={(e) => {
            setFocused(true)
            props.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            props.onBlur?.(e)
          }}
          style={[styles.input, props.multiline && styles.inputTextMulti]}
        />
        {right}
      </View>
      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={type.caption}>{hint}</Text>
      ) : null}
    </View>
  )
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  autoFocus?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <View style={[styles.search, focused && styles.inputFocused]}>
      <Feather name="search" size={18} color={focused ? colors.bar : colors.inkFaint} />
      <TextInput
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoFocus={autoFocus}
        placeholderTextColor={colors.inkFaint}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Clear search">
          <Feather name="x-circle" size={18} color={colors.inkFaint} />
        </Pressable>
      ) : null}
    </View>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <View style={styles.segmented} accessibilityRole="radiogroup">
      {options.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => {
            if (o.id !== value) tap()
            onChange(o.id)
          }}
          accessibilityRole="radio"
          accessibilityLabel={o.label}
          accessibilityState={{ checked: value === o.id }}
          style={[styles.segment, value === o.id && styles.segmentActive]}
        >
          <Text style={[styles.segmentLabel, value === o.id && styles.segmentLabelActive]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  )
}

export function Row({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: IconName
  title: string
  subtitle?: string
  right?: ReactNode
  onPress?: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}
    >
      {icon ? (
        <View style={styles.rowIcon}>
          <Feather name={icon} size={18} color={colors.barDeep} />
        </View>
      ) : null}
      <View style={styles.rowBody}>
        <Text style={type.body} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.small} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, height: 56 },
  headerSide: { width: 108, justifyContent: 'center' },
  back: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  headerRight: { alignItems: 'flex-end' },
  headerTitle: { flex: 1, textAlign: 'center', fontFamily: fonts.serif, fontSize: 18, color: colors.ink },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonOff: { opacity: 0.5 },
  buttonPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  buttonLabel: { fontFamily: fonts.sansSemi, fontSize: 15 },
  pressed: { opacity: 0.75 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipActive: { backgroundColor: colors.bar, borderColor: colors.bar },
  chipLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSoft, maxWidth: 160 },
  chipLabelActive: { color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, borderWidth: 1, borderColor: colors.line },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.xl, marginBottom: space.sm },
  sectionAction: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.bar },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillLabel: { fontFamily: fonts.sansMedium, fontSize: 12 },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.line, overflow: 'hidden' },
  fill: { height: 6, backgroundColor: colors.bar },
  empty: { alignItems: 'center', paddingVertical: space.xxl, paddingHorizontal: space.xl, gap: space.sm },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.barTint, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  emptyTitle: { fontFamily: fonts.sansSemi, fontSize: 16, color: colors.ink, textAlign: 'center' },
  emptyAction: { marginTop: space.md, alignSelf: 'center' },
  listLabel: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  skeleton: { backgroundColor: colors.line, borderRadius: radius.sm },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, marginBottom: space.sm },
  skeletonIcon: { width: 42, height: 42, borderRadius: radius.md },
  skeletonLines: { flex: 1, gap: space.sm },
  skeletonLineA: { height: 14, width: '70%' },
  skeletonLineB: { height: 11, width: '45%' },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, padding: space.md, borderRadius: radius.md, marginBottom: space.md },
  bannerIcon: { marginTop: 1 },
  bannerText: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 13, lineHeight: 18 },
  bannerAction: { fontFamily: fonts.sansSemi, fontSize: 13, textDecorationLine: 'underline' },
  avatar: { backgroundColor: colors.bar, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.serifBold, color: colors.white },
  emptyMessage: { textAlign: 'center' },
  field: { gap: 6, marginBottom: space.lg },
  inputWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingRight: space.sm,
  },
  input: { flex: 1, minHeight: 46, paddingHorizontal: space.md, fontFamily: fonts.sans, fontSize: 16, color: colors.ink },
  inputFocused: { borderColor: colors.focus, borderWidth: 2 },
  inputError: { borderColor: colors.seal },
  inputMulti: { minHeight: 240, alignItems: 'stretch' },
  inputTextMulti: { paddingTop: space.md, textAlignVertical: 'top', lineHeight: 24 },
  errorText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.seal },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans, fontSize: 15, color: colors.ink, paddingVertical: 0 },
  segmented: { flexDirection: 'row', backgroundColor: colors.line, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.surface, shadowColor: '#14202E', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentLabel: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSoft },
  segmentLabelActive: { color: colors.ink, fontFamily: fonts.sansSemi },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 64 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.barTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, gap: 2 },
})
