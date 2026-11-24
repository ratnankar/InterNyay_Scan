import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRecentScans } from '@/api/queries'
import { useNameLookups } from '@/api/lookups'
import type { Doc } from '@/api/types'
import { DocActions } from '@/components/DocActions'
import { DocRow } from '@/components/DocRow'
import { Card, EmptyState, Screen, SectionTitle, SkeletonRows } from '@/components/ui'
import { startScan } from '@/pipeline/useScanFlow'
import { useSession } from '@/store/session'
import { colors, fonts, radius, space, type } from '@/theme'
import { usePendingRows } from '@/upload/usePending'
import { firstName, greeting } from '@/utils/format'
import { tap } from '@/utils/haptics'

const STEPS = [
  { title: 'Scan or import', body: 'Use the camera, or pick photos and PDFs from your phone.' },
  { title: 'Tidy the pages', body: 'Crop, rotate and clean up. Reorder pages if needed.' },
  { title: 'File it', body: 'Choose the client or case and upload. It becomes searchable.' },
]

function today(): string {
  try {
    return new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  } catch {
    return ''
  }
}

function ImportTile({ icon, label, hint, onPress }: { icon: 'image' | 'file'; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${hint}`}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    >
      <View style={styles.tileIcon}>
        <Feather name={icon} size={20} color={colors.white} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.tileLabel}>{label}</Text>
        <Text style={styles.tileHint} numberOfLines={1}>
          {hint}
        </Text>
      </View>
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
        <Text style={styles.greeting} accessibilityRole="header">
          {name ? `${greeting()}, ${name}` : greeting()}
        </Text>
        <Text style={[type.small, styles.sub]}>{user?.advocateName ? `Associate of ${user.advocateName}` : today()}</Text>

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
          <Feather name="file-text" size={150} color="rgba(255,255,255,0.07)" style={styles.watermark} />
          <Text style={styles.heroTitle}>Scan a document</Text>
          <Text style={styles.heroBody}>Court papers, affidavits and ID proofs, filed straight to the right client or case.</Text>
          <Pressable
            onPress={() => {
              tap()
              void startScan()
            }}
            accessibilityRole="button"
            accessibilityLabel="Scan with camera"
            style={({ pressed }) => [styles.cta, pressed && styles.tilePressed]}
          >
            <Feather name="camera" size={22} color={colors.barDeep} />
            <Text style={styles.ctaText}>Scan with camera</Text>
          </Pressable>
          <View style={styles.tileRow}>
            <ImportTile icon="image" label="Photos" hint="From gallery" onPress={() => void startScan('gallery')} />
            <ImportTile icon="file" label="PDF" hint="From files" onPress={() => void startScan('pdf')} />
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
          <Card style={styles.steps}>
            <Text style={type.heading}>How scanning works</Text>
            {STEPS.map((step, i) => (
              <View key={step.title} style={styles.step}>
                <View style={styles.stepNo}>
                  <Text style={styles.stepNoText}>{i + 1}</Text>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={type.small}>{step.body}</Text>
                </View>
              </View>
            ))}
            <Text style={[type.caption, styles.stepsFoot]}>Your first upload will appear here under Recent scans.</Text>
          </Card>
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
  greeting: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 32, color: colors.ink },
  sub: { marginTop: 2, marginBottom: space.lg },
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  hero: { backgroundColor: colors.bar, borderRadius: 22, padding: space.lg, gap: space.md, overflow: 'hidden', marginBottom: space.sm },
  watermark: { position: 'absolute', right: -18, top: -14 },
  heroTitle: { fontFamily: fonts.serifBold, fontSize: 24, lineHeight: 30, color: colors.white },
  heroBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: colors.onBar, maxWidth: '82%', marginBottom: space.xs },
  cta: { minHeight: 56, borderRadius: radius.md, backgroundColor: colors.white, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  ctaText: { fontFamily: fonts.sansSemi, fontSize: 16, color: colors.barDeep },
  tileRow: { flexDirection: 'row', gap: space.md },
  tile: { flex: 1, minHeight: 56, borderRadius: radius.md, backgroundColor: colors.onBarTint, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md },
  tilePressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  tileIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.sansSemi, fontSize: 14, color: colors.white },
  tileHint: { fontFamily: fonts.sans, fontSize: 12, color: colors.onBar },
  steps: { gap: space.lg },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepNo: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.barTint, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNoText: { fontFamily: fonts.sansSemi, fontSize: 13, color: colors.barDeep },
  stepTitle: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink, marginBottom: 2 },
  stepsFoot: { color: colors.inkFaint },
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
