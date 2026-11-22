import { Feather } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { router } from 'expo-router'
import { useEffect, useState, type ComponentProps } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { ActionSheet, type ActionItem } from '@/components/Sheet'
import { Button, Chip, Header, Screen } from '@/components/ui'
import { FILTERS } from '@/imaging/filters'
import { usePreview } from '@/imaging/usePreview'
import { scanWithCamera } from '@/pipeline/importPages'
import type { EditPage } from '@/pipeline/types'
import { collectPages } from '@/pipeline/useScanFlow'
import { useDraft } from '@/store/draft'
import { colors, fonts, hit, radius, space, type } from '@/theme'
import { tap } from '@/utils/haptics'

type IconName = ComponentProps<typeof Feather>['name']

const ADD_ACTIONS: ActionItem[] = [
  { id: 'camera', label: 'Scan with camera', icon: 'camera' },
  { id: 'gallery', label: 'Import photos', icon: 'image' },
  { id: 'pdf', label: 'Import a PDF', icon: 'file' },
]

function Thumb({ page, index, selected, onPress }: { page: EditPage; index: number; selected: boolean; onPress: () => void }) {
  const preview = usePreview(page, 260, 40)
  return (
    <Pressable onPress={onPress} style={[styles.thumb, selected && styles.thumbSelected]} accessibilityLabel={`Page ${index + 1}`} accessibilityState={{ selected }}>
      {preview.uri ? <Image source={{ uri: preview.uri }} style={styles.thumbImage} resizeMode="cover" /> : <View style={styles.thumbImage} />}
      <View style={styles.thumbBadge}>
        <Text style={styles.thumbBadgeText}>{index + 1}</Text>
      </View>
    </Pressable>
  )
}

function Tool({ icon, label, onPress, active, danger }: { icon: IconName; label: string; onPress: () => void; active?: boolean; danger?: boolean }) {
  const color = danger ? colors.seal : active ? colors.bar : colors.ink
  return (
    <Pressable
      onPress={() => {
        tap()
        onPress()
      }}
      style={({ pressed }) => [styles.tool, active && styles.toolActive, pressed && styles.toolPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
    >
      <Feather name={icon} size={22} color={color} />
      <Text style={[styles.toolLabel, { color }]}>{label}</Text>
    </Pressable>
  )
}

export default function Edit() {
  const pages = useDraft((s) => s.pages)
  const selectedId = useDraft((s) => s.selectedId)
  const sessionId = useDraft((s) => s.sessionId)
  const { select, updatePage, applyToAll, removePage, movePage, replacePage, addPages, reset } = useDraft.getState()

  const page = pages.find((p) => p.id === selectedId) ?? pages[0]
  const index = page ? pages.findIndex((p) => p.id === page.id) : -1
  const preview = usePreview(page, 1400, 60)
  const [adjust, setAdjust] = useState(false)
  const [applyAll, setApplyAll] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sliding, setSliding] = useState<{ b: number; c: number } | null>(null)

  useEffect(() => {
    if (pages.length === 0) router.back()
  }, [pages.length])

  useEffect(() => {
    setSliding(null)
  }, [page?.id])

  if (!page) return <Screen>{null}</Screen>

  const patch = (change: Partial<EditPage>) => {
    if (applyAll && ('filter' in change || 'brightness' in change || 'contrast' in change)) applyToAll(change)
    else updatePage(page.id, change)
  }

  const discard = () =>
    Alert.alert('Discard this scan?', 'All pages you captured will be deleted.', [
      { text: 'Keep editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          reset()
          router.back()
        },
      },
    ])

  const remove = () =>
    Alert.alert('Delete this page?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (pages.length === 1) {
            reset()
            router.back()
          } else {
            removePage(page.id)
          }
        },
      },
    ])

  const retake = async () => {
    setBusy(true)
    try {
      const fresh = await scanWithCamera(sessionId, 1)
      if (fresh[0]) replacePage(page.id, fresh[0])
    } catch (e) {
      Alert.alert('Could not retake', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const add = async (source: string) => {
    setBusy(true)
    const added = await collectPages(source === 'gallery' ? 'gallery' : source === 'pdf' ? 'pdf' : 'camera')
    setBusy(false)
    if (added.length > 0) {
      addPages(added)
      select(added[0].id)
    }
  }

  const brightness = sliding?.b ?? page.brightness
  const contrast = sliding?.c ?? page.contrast

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={`Page ${index + 1} of ${pages.length}`}
        onBack={discard}
        right={<Button label="Next" icon="arrow-right" onPress={() => router.push('/review')} style={styles.next} />}
      />

      <View style={styles.stage}>
        {preview.uri ? <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="contain" /> : null}
        {preview.busy || busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.bar} />
          </View>
        ) : null}
        {preview.error ? <Text style={[type.small, styles.previewError]}>This page could not be processed.</Text> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => (
          <Chip key={f.id} label={f.label} active={page.filter === f.id} onPress={() => patch({ filter: f.id })} />
        ))}
      </ScrollView>

      {adjust ? (
        <View style={styles.adjust}>
          <View style={styles.sliderRow}>
            <Feather name="sun" size={18} color={colors.inkSoft} />
            <Text style={styles.sliderName}>Brightness</Text>
            <Slider
              style={styles.slider}
              minimumValue={-50}
              maximumValue={50}
              step={1}
              value={brightness}
              minimumTrackTintColor={colors.bar}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.bar}
              onValueChange={(v) => setSliding({ b: v, c: contrast })}
              onSlidingComplete={(v) => {
                setSliding(null)
                patch({ brightness: v })
              }}
              accessibilityLabel="Brightness"
            />
            <Text style={styles.sliderValue}>{brightness > 0 ? `+${brightness}` : `${brightness}`}</Text>
          </View>
          <View style={styles.sliderRow}>
            <Feather name="circle" size={18} color={colors.inkSoft} />
            <Text style={styles.sliderName}>Contrast</Text>
            <Slider
              style={styles.slider}
              minimumValue={-50}
              maximumValue={50}
              step={1}
              value={contrast}
              minimumTrackTintColor={colors.bar}
              maximumTrackTintColor={colors.line}
              thumbTintColor={colors.bar}
              onValueChange={(v) => setSliding({ b: brightness, c: v })}
              onSlidingComplete={(v) => {
                setSliding(null)
                patch({ contrast: v })
              }}
              accessibilityLabel="Contrast"
            />
            <Text style={styles.sliderValue}>{contrast > 0 ? `+${contrast}` : `${contrast}`}</Text>
          </View>
          <View style={styles.applyAll}>
            <Text style={[type.small, styles.flex]}>Apply filter and adjustments to all pages</Text>
            <Switch value={applyAll} onValueChange={setApplyAll} trackColor={{ true: colors.bar }} accessibilityLabel="Apply to all pages" />
          </View>
          {page.brightness !== 0 || page.contrast !== 0 ? (
            <Button label="Reset brightness and contrast" variant="ghost" onPress={() => patch({ brightness: 0, contrast: 0 })} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.tools}>
        <Tool icon="plus-square" label="Add" onPress={() => setAddOpen(true)} />
        <Tool icon="refresh-ccw" label="Retake" onPress={() => void retake()} />
        <Tool icon="crop" label="Crop" onPress={() => router.push({ pathname: '/crop', params: { id: page.id } })} />
        <Tool icon="rotate-cw" label="Rotate" onPress={() => updatePage(page.id, { rotation: ((page.rotation + 90) % 360) as EditPage['rotation'] })} />
        <Tool icon="sliders" label="Adjust" active={adjust} onPress={() => setAdjust((v) => !v)} />
        <Tool icon="trash-2" label="Delete" danger onPress={remove} />
      </View>

      <View style={styles.stripRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={pages}
          keyExtractor={(p) => p.id}
          contentContainerStyle={styles.strip}
          renderItem={({ item, index: i }) => <Thumb page={item} index={i} selected={item.id === page.id} onPress={() => select(item.id)} />}
        />
        <View style={styles.move}>
          <Pressable onPress={() => movePage(page.id, -1)} disabled={index === 0} style={styles.moveBtn} accessibilityRole="button" accessibilityLabel="Move page earlier">
            <Feather name="arrow-left" size={22} color={index === 0 ? colors.line : colors.ink} />
          </Pressable>
          <Pressable onPress={() => movePage(page.id, 1)} disabled={index === pages.length - 1} style={styles.moveBtn} accessibilityRole="button" accessibilityLabel="Move page later">
            <Feather name="arrow-right" size={22} color={index === pages.length - 1 ? colors.line : colors.ink} />
          </Pressable>
        </View>
      </View>

      <ActionSheet visible={addOpen} title="Add pages" actions={ADD_ACTIONS} onSelect={(id) => void add(id)} onClose={() => setAddOpen(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  stage: { flex: 1, marginHorizontal: space.lg, borderRadius: radius.md, backgroundColor: '#E7EBEF', overflow: 'hidden' },
  preview: { flex: 1 },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,246,248,0.45)' },
  previewError: { position: 'absolute', alignSelf: 'center', top: '45%' },
  filters: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  adjust: { paddingHorizontal: space.lg, gap: space.xs },
  flex: { flex: 1 },
  next: { minHeight: 40, paddingHorizontal: space.md },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sliderName: { width: 72, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSoft },
  sliderValue: { width: 34, textAlign: 'right', fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  slider: { flex: 1, height: 36 },
  applyAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tools: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tool: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 52, minHeight: hit + 8, borderRadius: radius.md, paddingHorizontal: 6 },
  toolActive: { backgroundColor: colors.barTint },
  toolPressed: { opacity: 0.6 },
  toolLabel: { fontFamily: fonts.sansMedium, fontSize: 11 },
  stripRow: { flexDirection: 'row', alignItems: 'center', paddingBottom: space.sm },
  strip: { gap: space.sm, paddingHorizontal: space.lg },
  move: { flexDirection: 'row', paddingRight: space.sm },
  moveBtn: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center' },
  thumb: { width: 56, height: 74, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', backgroundColor: colors.line },
  thumbSelected: { borderColor: colors.bar },
  thumbImage: { width: '100%', height: '100%' },
  thumbBadge: { position: 'absolute', bottom: 2, left: 2, backgroundColor: colors.barDeep, borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  thumbBadgeText: { color: colors.white, fontSize: 10, fontFamily: fonts.sansSemi },
})
