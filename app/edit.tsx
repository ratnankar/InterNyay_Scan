import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { router } from 'expo-router'
import { useEffect, useState, type ComponentProps } from 'react'
import { ActivityIndicator, Alert, FlatList, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { ActionSheet, type ActionItem } from '@/components/Sheet'
import { Button, Chip, Header, Screen } from '@/components/ui'
import { FILTERS } from '@/imaging/filters'
import { usePreview } from '@/imaging/usePreview'
import { exportDraftPdf } from '@/pdf/exportDraft'
import { previewPdf, sharePdf } from '@/pdf/localPdf'
import { scanWithCamera } from '@/pipeline/importPages'
import type { EditPage } from '@/pipeline/types'
import { collectPages } from '@/pipeline/useScanFlow'
import { useDraft } from '@/store/draft'
import { useSettings } from '@/store/settings'
import { colors, fonts, hit, radius, space, type } from '@/theme'
import { tap } from '@/utils/haptics'

type FeatherName = ComponentProps<typeof Feather>['name']
type CommunityName = ComponentProps<typeof MaterialCommunityIcons>['name']
type ToolIcon = { set: 'feather'; name: FeatherName } | { set: 'community'; name: CommunityName }
type Panel = 'filters' | 'adjust' | null

const SAVE_ACTIONS: ActionItem[] = [
  { id: 'upload', label: 'Save to InterNyay', icon: 'upload-cloud' },
  { id: 'phone', label: 'Save PDF to this phone', icon: 'download' },
  { id: 'share', label: 'Share PDF', icon: 'share-2' },
  { id: 'preview', label: 'Preview PDF', icon: 'eye' },
]

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

function Tool({ icon, label, onPress, active, danger }: { icon: ToolIcon; label: string; onPress: () => void; active?: boolean; danger?: boolean}) {
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
      {icon.set === 'feather' ? <Feather name={icon.name} size={22} color={color} /> : <MaterialCommunityIcons name={icon.name} size={24} color={color} />}
      <Text style={[styles.toolLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export default function Edit() {
  const pages = useDraft((s) => s.pages)
  const selectedId = useDraft((s) => s.selectedId)
  const sessionId = useDraft((s) => s.sessionId)
  const { select, updatePage, applyToAll, rotatePage, removePage, movePage, replacePage, addPages, reset } = useDraft.getState()
  const quality = useSettings((s) => s.quality)
  const name = useDraft((s) => s.name)

  const page = pages.find((p) => p.id === selectedId) ?? pages[0]
  const index = page ? pages.findIndex((p) => p.id === page.id) : -1
  const preview = usePreview(page, 1400, 60)
  const [panel, setPanel] = useState<Panel>('filters')
  const [applyAll, setApplyAll] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
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

  const hasMarks = page.strokes.length > 0 || page.texts.length > 0

  const crop = () => {
    const open = () => router.push({ pathname: '/crop', params: { id: page.id } })
    if (!hasMarks) {
      open()
      return
    }
    Alert.alert('Crop this page?', 'Cropping again removes the markup, erasing and text you added to this page.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Continue', onPress: open },
    ])
  }

  const annotate = (mode: 'markup' | 'magic' | 'cleanup' | 'text') => router.push({ pathname: '/annotate', params: { id: page.id, mode } })

  const pdf = async (action: 'phone' | 'share' | 'preview') => {
    setBusy(true)
    try {
      const file = await exportDraftPdf(sessionId, useDraft.getState().pages, name, quality)
      if (action === 'preview') await previewPdf(file)
      else await sharePdf(file, name)
    } catch (e) {
      Alert.alert('PDF failed', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const saveAction = (id: string) => {
    if (id === 'upload') router.push('/review')
    else void pdf(id as 'phone' | 'share' | 'preview')
  }

  const toggle = (next: Exclude<Panel, null>) => setPanel((cur) => (cur === next ? null : next))

  const brightness = sliding?.b ?? page.brightness
  const contrast = sliding?.c ?? page.contrast

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={`Page ${index + 1} of ${pages.length}`} onBack={discard} />

      <View style={styles.stage}>
        {preview.uri ? <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="contain" /> : null}
        {preview.busy || busy ? (
          <View style={styles.busy}>
            <ActivityIndicator color={colors.bar} />
          </View>
        ) : null}
        {preview.error ? <Text style={[type.small, styles.previewError]}>This page could not be processed.</Text> : null}
      </View>

      {panel === 'filters' ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Chip key={f.id} label={f.label} active={page.filter === f.id} onPress={() => patch({ filter: f.id })} />
          ))}
        </ScrollView>
      ) : null}

      {panel === 'adjust' ? (
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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolScroll} contentContainerStyle={styles.tools}>
        <Tool icon={{ set: 'feather', name: 'refresh-ccw' }} label="Retake" onPress={() => void retake()} />
        <Tool icon={{ set: 'feather', name: 'crop' }} label="Crop" onPress={crop} />
        <Tool icon={{ set: 'feather', name: 'rotate-cw' }} label="Rotate" onPress={() => rotatePage(page.id)} />
        <Tool icon={{ set: 'feather', name: 'type' }} label="Edit text" onPress={() => annotate('text')} />
        <Tool icon={{ set: 'feather', name: 'droplet' }} label="Filters" active={panel === 'filters'} onPress={() => toggle('filters')} />
        <Tool icon={{ set: 'community', name: 'auto-fix' }} label="Magic eraser" onPress={() => annotate('magic')} />
        <Tool icon={{ set: 'feather', name: 'sliders' }} label="Adjust" active={panel === 'adjust'} onPress={() => toggle('adjust')} />
        <Tool icon={{ set: 'feather', name: 'pen-tool' }} label="Markup" onPress={() => annotate('markup')} />
        <Tool icon={{ set: 'community', name: 'eraser' }} label="Cleanup" onPress={() => annotate('cleanup')} />
        <Tool icon={{ set: 'feather', name: 'maximize-2' }} label="Resize" onPress={() => router.push({ pathname: '/resize', params: { id: page.id } })} />
        <Tool icon={{ set: 'feather', name: 'trash-2' }} label="Delete" danger onPress={remove} />
      </ScrollView>

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

      <View style={styles.bottom}>
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Keep scanning"
          style={({ pressed }) => [styles.keep, pressed && styles.toolPressed]}
        >
          <Text style={styles.keepText}>Keep scanning</Text>
        </Pressable>
        <Pressable
          onPress={() => void pdf('share')}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Share PDF"
          style={({ pressed }) => [styles.shareBtn, pressed && styles.toolPressed]}
        >
          <Feather name="share-2" size={22} color={colors.ink} />
        </Pressable>
        <View style={styles.save}>
          <Pressable
            onPress={() => {
              tap()
              router.push('/review')
            }}
            accessibilityRole="button"
            accessibilityLabel="Save PDF"
            style={({ pressed }) => [styles.saveMain, pressed && styles.toolPressed]}
          >
            <Text style={styles.saveText}>Save PDF</Text>
          </Pressable>
          <View style={styles.saveDivider} />
          <Pressable
            onPress={() => setSaveOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="More save options"
            style={({ pressed }) => [styles.saveMore, pressed && styles.toolPressed]}
          >
            <Feather name="chevron-up" size={22} color={colors.white} />
          </Pressable>
        </View>
      </View>

      <ActionSheet visible={saveOpen} title="Save or share" actions={SAVE_ACTIONS} onSelect={saveAction} onClose={() => setSaveOpen(false)} />
      <ActionSheet visible={addOpen} title="Add pages" actions={ADD_ACTIONS} onSelect={(id) => void add(id)} onClose={() => setAddOpen(false)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  stage: { flex: 1, marginHorizontal: space.lg, borderRadius: radius.md, backgroundColor: '#E7EBEF', overflow: 'hidden' },
  preview: { flex: 1 },
  busy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(244,246,248,0.45)' },
  previewError: { position: 'absolute', alignSelf: 'center', top: '45%' },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filters: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  adjust: { paddingHorizontal: space.lg, gap: space.xs },
  flex: { flex: 1 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sliderName: { width: 72, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSoft },
  sliderValue: { width: 34, textAlign: 'right', fontFamily: fonts.sansMedium, fontSize: 13, color: colors.ink },
  slider: { flex: 1, height: 36 },
  applyAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toolScroll: { flexGrow: 0, flexShrink: 0, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tools: { gap: space.xs, paddingHorizontal: space.sm, paddingVertical: space.sm },
  tool: { alignItems: 'center', justifyContent: 'center', gap: 4, minWidth: 68, minHeight: hit + 8, borderRadius: radius.md, paddingHorizontal: 6 },
  bottom: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: space.xs },
  keep: { flex: 1, minHeight: 50, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  keepText: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.ink },
  shareBtn: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, borderColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  save: { flex: 1.3, minHeight: 50, borderRadius: radius.pill, backgroundColor: colors.bar, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  saveMain: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: fonts.sansSemi, fontSize: 15, color: colors.white },
  saveDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.onBar },
  saveMore: { width: 46, minHeight: 50, alignItems: 'center', justifyContent: 'center' },
  toolActive: { backgroundColor: colors.barTint },
  toolPressed: { opacity: 0.6 },
  toolLabel: { fontFamily: fonts.sansMedium, fontSize: 11, maxWidth: 76 },
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
