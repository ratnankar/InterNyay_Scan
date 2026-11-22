import { Feather } from '@expo/vector-icons'
import type { ComponentProps, ReactNode } from 'react'
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, fonts, hit, radius, space, type } from '@/theme'
import { tap } from '@/utils/haptics'

type IconName = ComponentProps<typeof Feather>['name']

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
              {title}
            </Text>
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
              <Feather name="x" size={22} color={colors.inkSoft} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

export type ActionItem = { id: string; label: string; icon: IconName; danger?: boolean; hidden?: boolean }

export function ActionSheet({
  visible,
  title,
  actions,
  onSelect,
  onClose,
}: {
  visible: boolean
  title: string
  actions: ActionItem[]
  onSelect: (id: string) => void
  onClose: () => void
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {actions
        .filter((a) => !a.hidden)
        .map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              tap()
              onClose()
              onSelect(a.id)
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Feather name={a.icon} size={20} color={a.danger ? colors.seal : colors.barDeep} />
            <Text style={[styles.actionLabel, a.danger && styles.danger]}>{a.label}</Text>
          </Pressable>
        ))}
    </Sheet>
  )
}

export function PickerSheet<T>({
  visible,
  title,
  items,
  keyOf,
  labelOf,
  subtitleOf,
  selectedKey,
  onPick,
  onClose,
  header,
  empty,
  loading,
}: {
  visible: boolean
  title: string
  items: T[]
  keyOf: (item: T) => string
  labelOf: (item: T) => string
  subtitleOf?: (item: T) => string | undefined
  selectedKey?: string | null
  onPick: (item: T) => void
  onClose: () => void
  header?: ReactNode
  empty: string
  loading?: boolean
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {header}
      <FlatList
        style={styles.list}
        data={items}
        keyExtractor={keyOf}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.bar} style={styles.loader} /> : <Text style={[type.small, styles.emptyText]}>{empty}</Text>
        }
        renderItem={({ item }) => {
          const selected = selectedKey === keyOf(item)
          const sub = subtitleOf?.(item)
          return (
            <Pressable
              onPress={() => {
                onPick(item)
                onClose()
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            >
              <View style={styles.optionBody}>
                <Text style={type.body} numberOfLines={1}>
                  {labelOf(item)}
                </Text>
                {sub ? (
                  <Text style={type.small} numberOfLines={1}>
                    {sub}
                  </Text>
                ) : null}
              </View>
              {selected ? <Feather name="check" size={20} color={colors.bar} /> : null}
            </Pressable>
          )
        }}
      />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    maxHeight: '80%',
  },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  title: { flex: 1, fontFamily: fonts.serif, fontSize: 20, lineHeight: 26, color: colors.ink },
  close: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center', marginRight: -space.sm },
  loader: { paddingVertical: space.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 54 },
  actionLabel: { fontFamily: fonts.sansMedium, fontSize: 16, color: colors.ink },
  danger: { color: colors.seal },
  pressed: { opacity: 0.7 },
  list: { marginTop: space.sm },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 60, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  optionBody: { flex: 1, gap: 2 },
  emptyText: { textAlign: 'center', paddingVertical: space.xl },
})
