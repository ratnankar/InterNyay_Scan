import { Feather } from '@expo/vector-icons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Doc } from '@/api/types'
import { colors, radius, space, type } from '@/theme'
import { formatDate } from '@/utils/format'
import { Pill } from './ui'

export function DocRow({ doc, onPress, context }: { doc: Doc; onPress: () => void; context?: string }) {
  const scan = doc.source === 'MOBILE_SCAN'
  const searchable = doc.ocrStatus === 'DONE'
  const parts = [doc.type, formatDate(doc.uploadedAt ?? doc.date), doc.pageCount ? `${doc.pageCount} pg` : null].filter(Boolean)
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${doc.name}. ${parts.join(', ')}. Open actions`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.icon, scan && styles.iconScan]}>
        <Feather name={scan ? 'camera' : 'file-text'} size={20} color={colors.barDeep} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {doc.name}
        </Text>
        <Text style={type.small} numberOfLines={1}>
          {parts.join('  ·  ')}
        </Text>
        {context ? (
          <Text style={type.small} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
        {scan ? (
          <View style={styles.pill}>
            <Pill label={searchable ? 'Searchable' : 'No text'} tone={searchable ? 'ok' : 'mute'} />
          </View>
        ) : null}
      </View>
      <Feather name="more-vertical" size={20} color={colors.inkFaint} style={styles.more} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: space.sm,
    minHeight: 64,
  },
  icon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  iconScan: { backgroundColor: colors.barTint },
  body: { flex: 1, gap: 2 },
  name: { fontFamily: type.body.fontFamily, fontSize: 15, lineHeight: 21, color: colors.ink },
  pill: { marginTop: space.xs },
  more: { alignSelf: 'center' },
  pressed: { opacity: 0.75 },
})
