import { Feather } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Image, type LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { Button, Header, Screen } from '@/components/ui'
import { orientedSize } from '@/imaging/marks'
import { MAX_RATIO, MIN_RATIO, PAGE_SIZES, customId, isCustom, pageSizeRatio, type PageSizeId } from '@/imaging/pageSizes'
import { usePreview } from '@/imaging/usePreview'
import type { EditPage } from '@/pipeline/types'
import { useDraft } from '@/store/draft'
import { colors, fonts, radius, space, type } from '@/theme'
import { tap } from '@/utils/haptics'

const MIN_SIDE = 90
const PAD = space.xl

function Handle({ style, label, onDrag }: { style: object; label: string; onDrag: (dx: number, dy: number, done: boolean) => void }) {
  const latest = useRef(onDrag)
  latest.current = onDrag
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => latest.current(g.dx, g.dy, false),
        onPanResponderRelease: (_, g) => latest.current(g.dx, g.dy, true),
        onPanResponderTerminate: (_, g) => latest.current(g.dx, g.dy, true),
      }),
    [],
  )
  return (
    <View {...responder.panHandlers} accessibilityRole="adjustable" accessibilityLabel={label} style={[styles.handleHit, style]}>
      <View style={styles.handleDot} />
    </View>
  )
}

export default function Resize() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const page = useDraft((s) => s.pages.find((p) => p.id === id))
  const count = useDraft((s) => s.pages.length)
  const [choice, setChoice] = useState<PageSizeId>(page?.pageSize ?? 'auto')
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [cust, setCust] = useState<{ w: number; h: number } | null>(null)
  const startSize = useRef({ w: 0, h: 0 })

  const plain: EditPage | undefined = useMemo(() => (page ? { ...page, pageSize: 'auto' } : undefined), [page])
  const preview = usePreview(plain, 1000, 40, 'resize')

  useEffect(() => {
    if (!page) router.back()
  }, [page])

  const needsCust = !!page && isCustom(choice) && !cust && box.w > 0
  useEffect(() => {
    if (!needsCust || !page) return
    const c = orientedSize(page)
    const r = pageSizeRatio(choice) ?? c.width / c.height
    const w = Math.min(Math.max(90, box.w - PAD * 2), Math.max(90, box.h - PAD * 2) * r)
    setCust({ w, h: w / r })
  }, [needsCust, page, choice, box.w, box.h])

  if (!page) return <Screen>{null}</Screen>

  const content = orientedSize(page)
  const ratio = pageSizeRatio(choice) ?? content.width / content.height
  const maxW = Math.max(0, box.w - space.xl * 2)
  const maxH = Math.max(0, box.h - space.xl * 2)
  const fitW = Math.min(maxW, maxH * ratio)
  const custom = isCustom(choice)
  const sheetW = custom && cust ? cust.w : fitW
  const sheetH = custom && cust ? cust.h : fitW / ratio
  const limitW = Math.max(MIN_SIDE, box.w - PAD * 2)
  const limitH = Math.max(MIN_SIDE, box.h - PAD * 2)

  const pickCustom = () => {
    tap()
    setCust({ w: fitW, h: fitW / ratio })
    setChoice(customId(ratio))
  }

  const dragSize = (mode: 'x' | 'y' | 'xy') => (dx: number, dy: number, done: boolean) => {
    if (!cust) return
    if (startSize.current.w === 0) startSize.current = { w: cust.w, h: cust.h }
    const start = startSize.current
    let w = mode === 'y' ? start.w : start.w + dx
    let h = mode === 'x' ? start.h : start.h + dy
    w = Math.min(limitW, Math.max(MIN_SIDE, w))
    h = Math.min(limitH, Math.max(MIN_SIDE, h))
    const r = Math.min(MAX_RATIO, Math.max(MIN_RATIO, w / h))
    if (w / h > MAX_RATIO) w = h * MAX_RATIO
    if (w / h < MIN_RATIO) h = w / MIN_RATIO
    setCust({ w, h })
    if (done) {
      startSize.current = { w: 0, h: 0 }
      setChoice(customId(r))
    }
  }

  const apply = () => {
    if (choice !== page.pageSize || count > 1) useDraft.getState().applyToAll({ pageSize: choice })
    router.back()
  }

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Resize pages" onBack={() => router.back()} right={<Button label="Apply" onPress={apply} style={styles.apply} />} />
      <View style={[styles.stage, custom && styles.stageTop]} onLayout={onLayout}>
        <View style={[styles.sheet, { width: sheetW, height: sheetH }, custom && { marginLeft: PAD, marginTop: PAD }]}>
          {preview.uri ? <Image source={{ uri: preview.uri }} style={styles.image} resizeMode="contain" /> : <ActivityIndicator color={colors.bar} />}
        </View>
        {custom && cust ? (
          <>
            <Handle label="Drag to change page width" style={{ left: PAD + sheetW - 22, top: PAD + sheetH / 2 - 22 }} onDrag={dragSize('x')} />
            <Handle label="Drag to change page height" style={{ left: PAD + sheetW / 2 - 22, top: PAD + sheetH - 22 }} onDrag={dragSize('y')} />
            <Handle label="Drag to resize the page" style={{ left: PAD + sheetW - 22, top: PAD + sheetH - 22 }} onDrag={dragSize('xy')} />
          </>
        ) : null}
      </View>
      <Text style={[type.small, styles.note]}>
        {custom ? 'Drag the handles on the paper to set its shape. ' : ''}
        {count > 1 ? `Applies to all ${count} pages. ` : ''}
        The page sits on the paper with white margins. Nothing is cropped.
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.options} style={styles.optionScroll}>
        {PAGE_SIZES.map((o) => {
          const on = o.id === choice
          const landscape = o.ratio !== null && o.ratio > 1
          return (
            <Pressable
              key={o.id}
              onPress={() => {
                tap()
                setChoice(o.id)
              }}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: on }}
              style={[styles.option, on && styles.optionOn]}
            >
              <Feather name={o.id === 'auto' ? 'maximize' : 'file'} size={26} color={on ? colors.bar : colors.inkSoft} style={landscape ? styles.rotated : undefined} />
              <Text style={[styles.optionLabel, on && styles.optionLabelOn]} numberOfLines={2}>
                {o.label}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          onPress={pickCustom}
          accessibilityRole="button"
          accessibilityLabel="Custom size"
          accessibilityState={{ selected: custom }}
          style={[styles.option, custom && styles.optionOn]}
        >
          <Feather name="move" size={26} color={custom ? colors.bar : colors.inkSoft} />
          <Text style={[styles.optionLabel, custom && styles.optionLabelOn]}>Custom</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  apply: { minHeight: 40, paddingHorizontal: space.lg },
  stage: { flex: 1, marginHorizontal: space.lg, borderRadius: radius.md, backgroundColor: '#E7EBEF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  sheet: { backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', shadowColor: '#14202E', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  image: { width: '100%', height: '100%' },
  note: { paddingHorizontal: space.lg, paddingTop: space.md },
  optionScroll: { flexGrow: 0 },
  options: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  option: { width: 92, minHeight: 84, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 6, borderWidth: 2, borderColor: 'transparent' },
  optionOn: { backgroundColor: colors.barTint, borderColor: colors.bar },
  optionLabel: { fontFamily: fonts.sansMedium, fontSize: 12, textAlign: 'center', color: colors.inkSoft },
  optionLabelOn: { color: colors.bar },
  stageTop: { alignItems: 'flex-start', justifyContent: 'flex-start' },
  handleHit: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  handleDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.bar },
  rotated: { transform: [{ rotate: '90deg' }] },
})
