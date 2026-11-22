import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRecentScans } from '@/api/queries'
import { useNameLookups } from '@/api/lookups'
import type { Doc } from '@/api/types'
import { DocActions } from '@/components/DocActions'
import { DocRow } from '@/components/DocRow'
import { Seal } from '@/components/Seal'
import { EmptyState, Screen, SectionTitle, SkeletonRows } from '@/components/ui'
import { startScan } from '@/pipeline/useScanFlow'
import { useSession } from '@/store/session'
import { colors, fonts, radius, space, type } from '@/theme'
import { usePendingRows } from '@/upload/usePending'
import { firstName, greeting } from '@/utils/format'
import { tap } from '@/utils/haptics'

function HeroAction({ icon, label, onPress }: { icon: 'image' | 'file'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.heroAction, pressed && styles.heroActionPressed]}
    >
      <Feather name={icon} size={18} color={colors.white} />
      <Text style={styles.heroActionLabel}>{label}</Text>
    </Pressable>
  )
}

export default function Home() {
  const user = useSession((s) => s.user)
  const recent = useRecentScans()
  const { waiting } = usePendingRows()
  const { describe } = useNameLookups()
  const [selected, setSelected] = useState<Doc | null>(null)

  const scans = recent.data?.content ?? []
  const name = firstName(user?.name)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={recent.isRefetching} onRefresh={() => void recent.refetch()} />}
      >
        <Text style={type.display} accessibilityRole="header">
          {name ? `${greeting()}, ${name}` : greeting()}
        </Text>
        {user?.advocateName ? <Text style={[type.small, styles.sub]}>{`Associate of ${user.advocateName}`}</Text> : <View style={styles.subGap} />}

        {waiting.length > 0 ? (
          <Pressable
            onPress={() => router.navigate('/scans')}
            accessibilityRole="button"
            accessibilityLabel={`${waiting.length} scans waiting to upload. Open My Scans`}
            style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
          >
            <Feather name="upload-cloud" size={22} color={colors.ochre} />
            <View style={styles.flex}>
              <Text style={type.heading}>{waiting.length === 1 ? '1 scan is waiting to upload' : `${waiting.length} scans are waiting to upload`}</Text>
              <Text style={type.small}>Tap to check status or retry.</Text>
            </View>
            <Feather name="chevron-right" size={20} color={colors.ochre} />
          </Pressable>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <Seal size={76} tone="light" label="Scan a document with the camera" onPress={() => void startScan()} />
            <View style={styles.heroText}>
              <Text style={styles.heroTitle}>Scan a document</Text>
              <Text style={styles.heroBody}>Court papers, affidavits, ID proofs. Edges are found for you.</Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <HeroAction icon="image" label="Import photos" onPress={() => void startScan('gallery')} />
            <HeroAction icon="file" label="Import PDF" onPress={() => void startScan('pdf')} />
          </View>
        </View>

        <SectionTitle title="Recent scans" action={scans.length > 0 ? 'See all' : undefined} onAction={() => router.navigate('/scans')} />
        {recent.isLoading ? (
          <SkeletonRows count={3} />
        ) : recent.isError ? (
          <EmptyState
            icon="wifi-off"
            title="Could not load recent scans"
            message="Check your connection, then try again."
            action="Try again"
            onAction={() => void recent.refetch()}
          />
        ) : scans.length === 0 ? (
          <EmptyState icon="camera" title="No scans yet" message="Scan your first document. It will show up here once it uploads." />
        ) : (
          scans.map((d) => <DocRow key={d.id} doc={d} context={describe(d.clientId, d.caseId)} onPress={() => setSelected(d)} />)
        )}
      </ScrollView>
      <DocActions doc={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  sub: { marginTop: 2, marginBottom: space.lg },
  subGap: { height: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  hero: { backgroundColor: colors.bar, borderRadius: radius.lg, padding: space.lg, gap: space.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  heroText: { flex: 1, gap: 4 },
  heroTitle: { fontFamily: fonts.serifBold, fontSize: 22, lineHeight: 28, color: colors.white },
  heroBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.onBar },
  heroActions: { flexDirection: 'row', gap: space.md },
  heroAction: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.md,
    backgroundColor: colors.onBarTint,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  heroActionPressed: { opacity: 0.75 },
  heroActionLabel: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    marginBottom: space.lg,
    backgroundColor: colors.ochreTint,
    borderRadius: radius.md,
  },
})
