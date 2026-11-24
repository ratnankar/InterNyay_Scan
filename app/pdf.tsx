import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { File } from 'expo-file-system'
import * as Print from 'expo-print'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import PdfThumbnail from 'react-native-pdf-thumbnail'
import { EmptyState, Header, Screen } from '@/components/ui'
import { sharePdf } from '@/pdf/localPdf'
import { colors, fonts, hit, radius, space, type } from '@/theme'

type PageImage = { uri: string; width: number; height: number }

const ZOOMS = [1, 1.5, 2, 3]

export default function PdfViewer() {
  const { uri, name } = useLocalSearchParams<{ uri: string; name?: string }>()
  const { width } = useWindowDimensions()
  const [pages, setPages] = useState<PageImage[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoom, setZoom] = useState(0)

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        if (!uri) throw new Error('missing file')
        const result = await PdfThumbnail.generateAllPages(uri, { quality: 100 })
        if (alive) setPages(result)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
    }
  }, [uri])

  const share = async () => {
    try {
      if (uri) await sharePdf(new File(uri), name ?? 'Document')
    } catch (e) {
      Alert.alert('Could not share', e instanceof Error ? e.message : 'Please try again.')
    }
  }

  const print = async () => {
    try {
      if (uri) await Print.printAsync({ uri })
    } catch (e) {
      Alert.alert('Could not print', e instanceof Error ? e.message : 'Please try again.')
    }
  }

  const scale = ZOOMS[zoom] ?? 1
  const pageWidth = (width - space.lg * 2) * scale

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={name ?? 'Document'}
        onBack={() => router.back()}
        right={
          <View style={styles.actions}>
            <Pressable onPress={() => void print()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Print">
              <Feather name="printer" size={22} color={colors.ink} />
            </Pressable>
            <Pressable onPress={() => void share()} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Share or save PDF">
              <Feather name="share-2" size={22} color={colors.ink} />
            </Pressable>
          </View>
        }
      />
      {failed ? (
        <EmptyState icon="file-text" title="This PDF could not be shown" message="You can still share or save it using the button at the top." />
      ) : pages === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.bar} size="large" />
          <Text style={[type.small, styles.loading]}>Opening document…</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal style={styles.flex} contentContainerStyle={{ width: pageWidth + space.lg * 2 }} nestedScrollEnabled>
            <FlatList
              data={pages}
              keyExtractor={(p, i) => `${i}-${p.uri}`}
              nestedScrollEnabled
              contentContainerStyle={styles.list}
              initialNumToRender={2}
              windowSize={5}
              renderItem={({ item, index }) => (
                <View style={styles.pageWrap} accessibilityLabel={`Page ${index + 1} of ${pages.length}`}>
                  <Image source={{ uri: item.uri }} style={{ width: pageWidth, aspectRatio: item.width / item.height }} resizeMode="contain" />
                </View>
              )}
            />
          </ScrollView>
          <View style={styles.zoomBar}>
            <Pressable
              onPress={() => setZoom((z) => Math.max(0, z - 1))}
              disabled={zoom === 0}
              style={[styles.zoomBtn, zoom === 0 && styles.off]}
              accessibilityRole="button"
              accessibilityLabel="Zoom out"
            >
              <Feather name="zoom-out" size={22} color={colors.ink} />
            </Pressable>
            <Text style={styles.zoomText}>{`${pages.length} ${pages.length === 1 ? 'page' : 'pages'}  ·  ${Math.round(scale * 100)}%`}</Text>
            <Pressable
              onPress={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}
              disabled={zoom === ZOOMS.length - 1}
              style={[styles.zoomBtn, zoom === ZOOMS.length - 1 && styles.off]}
              accessibilityRole="button"
              accessibilityLabel="Zoom in"
            >
              <Feather name="zoom-in" size={22} color={colors.ink} />
            </Pressable>
          </View>
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  loading: { color: colors.inkSoft },
  actions: { flexDirection: 'row' },
  iconBtn: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md },
  pageWrap: { backgroundColor: colors.surface, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  zoomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
  zoomBtn: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  zoomText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSoft },
  off: { opacity: 0.35 },
})
