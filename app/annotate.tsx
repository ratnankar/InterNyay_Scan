import { Feather } from '@expo/vector-icons'
import Slider from '@react-native-community/slider'
import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia'
import { router, useLocalSearchParams } from 'expo-router'
import { File } from 'expo-file-system'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Alert, Image, type LayoutChangeEvent, PanResponder, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native'
import { Sheet } from '@/components/Sheet'
import { Button, Header, Screen } from '@/components/ui'
import {
  HIGHLIGHT_COLORS,
  PEN_COLORS,
  TEXT_COLORS,
  clamp01,
  orientedSize,
  replaceLine,
  shortEdge,
  simplifyPoints,
  textBounds,
  type Stroke,
  type StrokeKind,
  type TextBox,
} from '@/imaging/marks'
import { measureText, renderToFile } from '@/imaging/render'
import { usePreview } from '@/imaging/usePreview'
import { recognizeLines } from '@/ocr/recognize'
import type { OcrLine } from '@/ocr/types'
import { draftDir } from '@/pipeline/importPages'
import type { EditPage } from '@/pipeline/types'
import { useDraft } from '@/store/draft'
import { useSettings } from '@/store/settings'
import { colors, fonts, hit, radius, space, type } from '@/theme'
import { tap } from '@/utils/haptics'
import { newId } from '@/utils/format'

type Mode = 'markup' | 'magic' | 'cleanup' | 'text'
type Snapshot = { strokes: Stroke[]; texts: TextBox[] }
type Rect = { x: number; y: number; w: number; h: number }

const MODES: Mode[] = ['markup', 'magic', 'cleanup', 'text']
const TITLES: Record<Mode, string> = { markup: 'Markup', magic: 'Magic eraser', cleanup: 'Cleanup', text: 'Edit text' }
const HINTS: Record<Mode, string> = {
  markup: 'Draw on the page with a pen or highlighter.',
  magic: 'Paint over a stain, mark or signature. It is filled in with the paper around it.',
  cleanup: 'Paint over anything you want wiped to clean white.',
  text: 'Add text, or tap Find text to replace what is already printed.',
}

function Swatches({ palette, value, onChange }: { palette: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <View style={styles.swatches}>
      {palette.map((c) => (
        <Pressable
          key={c}
          onPress={() => {
            tap()
            onChange(c)
          }}
          accessibilityRole="button"
          accessibilityLabel={`Colour ${c}`}
          accessibilityState={{ selected: value === c }}
          style={[styles.swatch, { backgroundColor: c }, value === c && styles.swatchOn]}
        />
      ))}
    </View>
  )
}

function SliderRow({
  label,
  value,
  min,
  max,
  onDone,
}: {
  label: string
  value: number
  min: number
  max: number
  onDone: (v: number) => void
}) {
  return (
    <View style={styles.sliderRow}>
      <Text style={styles.sliderName}>{label}</Text>
      <Slider
        key={value}
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        value={value}
        minimumTrackTintColor={colors.bar}
        maximumTrackTintColor={colors.line}
        thumbTintColor={colors.bar}
        onSlidingComplete={onDone}
        accessibilityLabel={label}
      />
    </View>
  )
}

function TextFrame({ rect, selected, onSelect, onMove, onScale }: { rect: Rect; selected: boolean; onSelect: () => void; onMove: (dx: number, dy: number) => void; onScale: (factor: number) => void }) {
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const moved = useRef(false)
  const [grow, setGrow] = useState(0)
  const latest = useRef({ onSelect, onMove, onScale, w: rect.w })
  latest.current = { onSelect, onMove, onScale, w: Math.max(rect.w, 32) }
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          moved.current = false
          latest.current.onSelect()
        },
        onPanResponderMove: (_, g) => {
          if (Math.abs(g.dx) + Math.abs(g.dy) > 4) moved.current = true
          setDrag({ x: g.dx, y: g.dy })
        },
        onPanResponderRelease: (_, g) => {
          setDrag({ x: 0, y: 0 })
          if (moved.current) latest.current.onMove(g.dx, g.dy)
        },
        onPanResponderTerminate: () => setDrag({ x: 0, y: 0 }),
      }),
    [],
  )
  const handle = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderMove: (_, g) => setGrow(g.dx),
        onPanResponderRelease: (_, g) => {
          setGrow(0)
          latest.current.onScale(Math.max(0.3, (latest.current.w + g.dx) / latest.current.w))
        },
        onPanResponderTerminate: () => setGrow(0),
      }),
    [],
  )
  const baseW = Math.max(rect.w, 32)
  const baseH = Math.max(rect.h, 32)
  const factor = Math.max(0.3, (baseW + grow) / baseW)
  const w = baseW * factor
  const h = baseH * factor
  return (
    <View
      {...responder.panHandlers}
      accessibilityRole="button"
      accessibilityLabel="Text box"
      accessibilityState={{ selected }}
      style={[styles.frame, selected && styles.frameOn, { left: rect.x + drag.x - (baseW - rect.w) / 2, top: rect.y + drag.y - (baseH - rect.h) / 2, width: w, height: h }]}
    >
      {selected ? <View {...handle.panHandlers} accessibilityRole="adjustable" accessibilityLabel="Drag to resize text" style={styles.grip} hitSlop={12} /> : null}
    </View>
  )
}

function livePath(points: number[]) {
  const b = Skia.PathBuilder.Make()
  b.moveTo(points[0], points[1])
  for (let i = 2; i + 1 < points.length; i += 2) b.lineTo(points[i], points[i + 1])
  return b.build()
}

function liveStyle(kind: StrokeKind, color: string): { color: string; opacity: number; blend?: 'multiply' } {
  if (kind === 'highlight') return { color, opacity: 0.45, blend: 'multiply' }
  if (kind === 'magic') return { color: '#1D4E89', opacity: 0.35 }
  if (kind === 'clean') return { color: '#8A96A3', opacity: 0.45 }
  return { color, opacity: 1 }
}

export default function Annotate() {
  const { id, mode: modeParam } = useLocalSearchParams<{ id: string; mode?: string }>()
  const mode: Mode = MODES.includes(modeParam as Mode) ? (modeParam as Mode) : 'markup'
  const page = useDraft((s) => s.pages.find((p) => p.id === id))
  const sessionId = useDraft((s) => s.sessionId)
  const language = useSettings((s) => s.language)

  const [strokes, setStrokes] = useState<Stroke[]>(page?.strokes ?? [])
  const [texts, setTexts] = useState<TextBox[]>(page?.texts ?? [])
  const [history, setHistory] = useState<Snapshot[]>([])
  const [edit, setEdit] = useState(0)
  const [pending, setPending] = useState<{ n: number; stroke: Stroke }[]>([])
  const [live, setLive] = useState<number[]>([])
  const [box, setBox] = useState({ w: 0, h: 0 })

  const [tool, setTool] = useState<'pen' | 'highlight'>('pen')
  const [penColor, setPenColor] = useState(PEN_COLORS[1])
  const [hlColor, setHlColor] = useState(HIGHLIGHT_COLORS[0])
  const [penWidth, setPenWidth] = useState(0.006)
  const [hlWidth, setHlWidth] = useState(0.035)
  const [eraseWidth, setEraseWidth] = useState(0.045)

  const [selected, setSelected] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; value: string } | null>(null)
  const [lines, setLines] = useState<{ lines: OcrLine[]; width: number; height: number } | null>(null)
  const [finding, setFinding] = useState(false)

  const content = page ? orientedSize(page) : { width: 1, height: 1 }
  const rect: Rect = useMemo(() => {
    if (box.w === 0 || box.h === 0) return { x: 0, y: 0, w: 0, h: 0 }
    const scale = Math.min(box.w / content.width, box.h / content.height)
    const w = content.width * scale
    const h = content.height * scale
    return { x: (box.w - w) / 2, y: (box.h - h) / 2, w, h }
  }, [box, content.width, content.height])

  // The editor previews the page without a paper size so that screen positions map straight onto the content.
  const working: EditPage | undefined = useMemo(
    () => (page ? { ...page, strokes, texts, pageSize: 'auto', rev: edit } : undefined),
    [page, strokes, texts, edit],
  )
  const preview = usePreview(working, 1400, 60, `ann${page?.rev ?? 0}`)

  const kind: StrokeKind = mode === 'magic' ? 'magic' : mode === 'cleanup' ? 'clean' : tool === 'highlight' ? 'highlight' : 'pen'
  const brush = {
    kind,
    color: tool === 'highlight' ? hlColor : penColor,
    width: mode === 'markup' ? (tool === 'highlight' ? hlWidth : penWidth) : eraseWidth,
  }

  const state = useRef({ strokes, texts, edit, brush, rect, mode })
  state.current = { strokes, texts, edit, brush, rect, mode }

  const commit = (next: Snapshot, added?: Stroke) => {
    const cur = state.current
    setHistory((h) => [...h, { strokes: cur.strokes, texts: cur.texts }])
    setStrokes(next.strokes)
    setTexts(next.texts)
    const n = cur.edit + 1
    setEdit(n)
    state.current = { ...cur, strokes: next.strokes, texts: next.texts, edit: n }
    if (added) setPending((p) => [...p, { n, stroke: added }])
  }
  const commitRef = useRef(commit)
  commitRef.current = commit

  useEffect(() => {
    if (!page) router.back()
  }, [page])

  const responder = useMemo(() => {
    let origin = { x: 0, y: 0 }
    let points: number[] = []
    const toNorm = (dx: number, dy: number) => {
      const r = state.current.rect
      if (r.w === 0 || r.h === 0) return null
      return { x: clamp01((origin.x + dx - r.x) / r.w), y: clamp01((origin.y + dy - r.y) / r.h) }
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => state.current.mode !== 'text',
      onMoveShouldSetPanResponder: () => state.current.mode !== 'text',
      onPanResponderGrant: (e) => {
        origin = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY }
        const p = toNorm(0, 0)
        points = p ? [p.x, p.y] : []
        const r = state.current.rect
        setLive(p ? [r.x + p.x * r.w, r.y + p.y * r.h] : [])
      },
      onPanResponderMove: (_, g) => {
        const p = toNorm(g.dx, g.dy)
        if (!p || points.length === 0) return
        points.push(p.x, p.y)
        const r = state.current.rect
        setLive((cur) => [...cur, r.x + p.x * r.w, r.y + p.y * r.h])
      },
      onPanResponderRelease: () => {
        setLive([])
        if (points.length < 2) return
        const b = state.current.brush
        const stroke: Stroke = { kind: b.kind, color: b.color, width: b.width, points: simplifyPoints(points, 0.0015) }
        points = []
        commitRef.current({ strokes: [...state.current.strokes, stroke], texts: state.current.texts }, stroke)
      },
      onPanResponderTerminate: () => {
        points = []
        setLive([])
      },
    })
  }, [])

  if (!page || !working) return <Screen>{null}</Screen>

  const dirty = history.length > 0
  const shown = preview.rev ?? -1
  const overlay = pending.filter((p) => p.n > shown && strokes.includes(p.stroke))
  const short = shortEdge(rect.w, rect.h)

  const undo = () => {
    const last = history[history.length - 1]
    if (!last) return
    tap()
    setHistory((h) => h.slice(0, -1))
    setStrokes(last.strokes)
    setTexts(last.texts)
    setEdit((e) => e + 1)
    setSelected(null)
  }

  const done = () => {
    if (dirty) useDraft.getState().updatePage(page.id, { strokes, texts })
    router.back()
  }

  const cancel = () => {
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert('Discard changes?', 'Your edits to this page will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ])
  }

  const clearAll = () => {
    if (strokes.length === 0 && texts.length === 0) return
    Alert.alert('Remove all markup?', 'This removes every stroke and text box on this page.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove all', style: 'destructive', onPress: () => commit({ strokes: [], texts: [] }) },
    ])
  }

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })

  // ---- text ----
  const selectedBox = texts.find((t) => t.id === selected) ?? null
  const patchText = (tid: string, change: Partial<TextBox>) =>
    commit({ strokes, texts: texts.map((t) => (t.id === tid ? { ...t, ...change } : t)) })

  const frameFor = (t: TextBox): Rect => {
    const m = measureText(t, content.width, content.height)
    const b = textBounds(t, content.width, content.height, m.width, m.height)
    const k = rect.w / content.width
    return { x: rect.x + b.x * k, y: rect.y + b.y * k, w: b.width * k, h: b.height * k }
  }

  const saveText = () => {
    if (!editing) return
    const value = editing.value.trim()
    if (editing.id) {
      if (value.length === 0) {
        commit({ strokes, texts: texts.filter((t) => t.id !== editing.id) })
        setSelected(null)
      } else {
        patchText(editing.id, { text: value })
      }
    } else if (value.length > 0) {
      const fresh: TextBox = { id: newId(), text: value, cx: 0.5, cy: 0.5, size: 0.035, w: 0.6, color: TEXT_COLORS[0], bg: false, rot: 0 }
      commit({ strokes, texts: [...texts, fresh] })
      setSelected(fresh.id)
    }
    setEditing(null)
  }

  const findText = async () => {
    setFinding(true)
    setSelected(null)
    try {
      const out = await renderToFile(working, 1600, 80, new File(draftDir(sessionId), 'detect.jpg'))
      const found = await recognizeLines(out.uri, language)
      if (found.length === 0) Alert.alert('No text found', 'Try a clearer page, or add text with the Add text button.')
      setLines({ lines: found, width: out.width, height: out.height })
    } catch (e) {
      Alert.alert('Could not read the page', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setFinding(false)
    }
  }

  const pickLine = (line: OcrLine) => {
    if (!lines) return
    const made = replaceLine(line, lines.width, lines.height, content.width, content.height, newId())
    commit({ strokes: [...strokes, made.erase], texts: [...texts, made.box] })
    setLines({ ...lines, lines: lines.lines.filter((l) => l !== line) })
    setSelected(made.box.id)
    setEditing({ id: made.box.id, value: made.box.text })
  }

  const palette = tool === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS

  return (
    <Screen edges={['top', 'bottom']}>
      <Header
        title={TITLES[mode]}
        onBack={cancel}
        right={
          <View style={styles.headerActions}>
            <Pressable onPress={undo} disabled={!dirty} hitSlop={6} accessibilityRole="button" accessibilityLabel="Undo" style={styles.iconBtn}>
              <Feather name="corner-up-left" size={22} color={dirty ? colors.ink : colors.line} />
            </Pressable>
            <Button label="Done" onPress={done} style={styles.done} />
          </View>
        }
      />

      <View style={styles.stage} onLayout={onLayout} {...responder.panHandlers}>
        {preview.uri ? <Image source={{ uri: preview.uri }} style={styles.preview} resizeMode="contain" pointerEvents="none" /> : null}
        <Canvas style={styles.overlay} pointerEvents="none">
          {[...overlay.map((o) => o.stroke), ...(live.length >= 2 ? [{ kind, color: brush.color, width: brush.width, points: live } as Stroke] : [])].map((s, i) => {
            const style = liveStyle(s.kind, s.color)
            const isLive = s.points === live
            const px = isLive ? s.points : s.points.map((v, j) => (j % 2 === 0 ? rect.x + v * rect.w : rect.y + v * rect.h))
            const size = Math.max(1, s.width * short)
            if (px.length < 4) return <Circle key={i} cx={px[0]} cy={px[1]} r={size / 2} color={style.color} opacity={style.opacity} />
            return (
              <Path
                key={i}
                path={livePath(px)}
                color={style.color}
                style="stroke"
                strokeWidth={size}
                strokeCap="round"
                strokeJoin="round"
                opacity={style.opacity}
                blendMode={style.blend}
              />
            )
          })}
        </Canvas>

        {mode === 'text' && !lines
          ? texts.map((t) => (
              <TextFrame
                key={t.id}
                rect={frameFor(t)}
                selected={t.id === selected}
                onSelect={() => setSelected(t.id)}
                onScale={(f) => patchText(t.id, { size: Math.min(0.2, Math.max(0.012, t.size * f)), w: Math.min(2.5, Math.max(0.05, t.w * f)) })}
                onMove={(dx, dy) => patchText(t.id, { cx: clamp01(t.cx + dx / rect.w), cy: clamp01(t.cy + dy / rect.h) })}
              />
            ))
          : null}

        {mode === 'text' && lines
          ? lines.lines.map((l, i) => (
              <Pressable
                key={`${i}-${l.text}`}
                onPress={() => pickLine(l)}
                accessibilityRole="button"
                accessibilityLabel={`Replace text: ${l.text}`}
                style={[
                  styles.line,
                  {
                    left: rect.x + (l.x / lines.width) * rect.w - 3,
                    top: rect.y + (l.y / lines.height) * rect.h - 3,
                    width: (l.w / lines.width) * rect.w + 6,
                    height: Math.max(22, (l.h / lines.height) * rect.h + 6),
                  },
                ]}
              />
            ))
          : null}

        {preview.busy || finding ? (
          <View style={styles.busy} pointerEvents="none">
            <ActivityIndicator color={colors.bar} />
          </View>
        ) : null}
      </View>

      <View style={styles.panel}>
        {mode === 'markup' ? (
          <>
            <View style={styles.toolRow}>
              <Pressable onPress={() => setTool('pen')} style={[styles.toolBtn, tool === 'pen' && styles.toolBtnOn]} accessibilityRole="button" accessibilityLabel="Pen" accessibilityState={{ selected: tool === 'pen' }}>
                <Feather name="edit-2" size={18} color={tool === 'pen' ? colors.white : colors.ink} />
                <Text style={[styles.toolText, tool === 'pen' && styles.toolTextOn]}>Pen</Text>
              </Pressable>
              <Pressable onPress={() => setTool('highlight')} style={[styles.toolBtn, tool === 'highlight' && styles.toolBtnOn]} accessibilityRole="button" accessibilityLabel="Highlighter" accessibilityState={{ selected: tool === 'highlight' }}>
                <Feather name="edit-3" size={18} color={tool === 'highlight' ? colors.white : colors.ink} />
                <Text style={[styles.toolText, tool === 'highlight' && styles.toolTextOn]}>Highlighter</Text>
              </Pressable>
              <Pressable onPress={clearAll} style={styles.toolBtn} accessibilityRole="button" accessibilityLabel="Remove all markup">
                <Feather name="trash-2" size={18} color={colors.seal} />
                <Text style={[styles.toolText, { color: colors.seal }]}>Clear</Text>
              </Pressable>
            </View>
            <Swatches palette={palette} value={tool === 'highlight' ? hlColor : penColor} onChange={tool === 'highlight' ? setHlColor : setPenColor} />
            <SliderRow
              label="Thickness"
              value={tool === 'highlight' ? hlWidth : penWidth}
              min={tool === 'highlight' ? 0.015 : 0.002}
              max={tool === 'highlight' ? 0.07 : 0.02}
              onDone={tool === 'highlight' ? setHlWidth : setPenWidth}
            />
          </>
        ) : null}

        {mode === 'magic' || mode === 'cleanup' ? (
          <>
            <Text style={type.small}>{HINTS[mode]}</Text>
            <SliderRow label="Brush size" value={eraseWidth} min={0.012} max={0.12} onDone={setEraseWidth} />
          </>
        ) : null}

        {mode === 'text' ? (
          <>
            {lines ? (
              <View style={styles.toolRow}>
                <Text style={[type.small, styles.flex]}>Tap a highlighted line to replace its text.</Text>
                <Button label="Cancel" variant="secondary" onPress={() => setLines(null)} style={styles.small} />
              </View>
            ) : (
              <View style={styles.toolRow}>
                <Button label="Add text" icon="plus" variant="secondary" onPress={() => setEditing({ id: null, value: '' })} style={styles.flex} />
                <Button label="Find text" icon="search" variant="secondary" loading={finding} onPress={() => void findText()} style={styles.flex} />
              </View>
            )}
            {selectedBox && !lines ? (
              <>
                <View style={styles.toolRow}>
                  <Button label="Edit" icon="edit-2" variant="secondary" onPress={() => setEditing({ id: selectedBox.id, value: selectedBox.text })} style={styles.flex} />
                  <Button
                    label="Delete"
                    icon="trash-2"
                    variant="secondary"
                    onPress={() => {
                      commit({ strokes, texts: texts.filter((t) => t.id !== selectedBox.id) })
                      setSelected(null)
                    }}
                    style={styles.flex}
                  />
                </View>
                <Swatches palette={TEXT_COLORS} value={selectedBox.color} onChange={(c) => patchText(selectedBox.id, { color: c })} />
                <SliderRow label="Size" value={selectedBox.size} min={0.015} max={0.12} onDone={(v) => patchText(selectedBox.id, { size: v })} />
                <View style={styles.toolRow}>
                  <Text style={[type.small, styles.flex]}>White background behind text</Text>
                  <Switch value={selectedBox.bg} onValueChange={(v) => patchText(selectedBox.id, { bg: v })} trackColor={{ true: colors.bar }} accessibilityLabel="White background" />
                </View>
              </>
            ) : !lines ? (
              <Text style={type.small}>{texts.length > 0 ? 'Tap a text box to change it, drag it to move it, or drag its corner to resize it.' : HINTS.text}</Text>
            ) : null}
          </>
        ) : null}
      </View>

      <Sheet visible={editing !== null} title={editing?.id ? 'Edit text' : 'Add text'} onClose={() => setEditing(null)}>
        <TextInput
          value={editing?.value ?? ''}
          onChangeText={(v) => setEditing((cur) => (cur ? { ...cur, value: v } : cur))}
          multiline
          autoFocus
          placeholder="Type here"
          placeholderTextColor={colors.inkFaint}
          style={styles.input}
          accessibilityLabel="Text"
        />
        <View style={styles.toolRow}>
          <Button label="Cancel" variant="secondary" onPress={() => setEditing(null)} style={styles.flex} />
          <Button label="Done" onPress={saveText} style={styles.flex} />
        </View>
      </Sheet>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  iconBtn: { width: hit - 6, height: hit, alignItems: 'center', justifyContent: 'center' },
  done: { minHeight: 40, paddingHorizontal: space.md },
  small: { minHeight: 40, paddingHorizontal: space.md },
  stage: { flex: 1, marginHorizontal: space.lg, borderRadius: radius.md, backgroundColor: '#E7EBEF', overflow: 'hidden' },
  preview: { ...StyleSheet.absoluteFill },
  overlay: { ...StyleSheet.absoluteFill },
  busy: { position: 'absolute', top: space.md, right: space.md, padding: space.sm, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.8)' },
  panel: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm, gap: space.sm },
  toolRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  toolBtn: { flex: 1, minHeight: 44, borderRadius: radius.md, backgroundColor: colors.barTint, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  toolBtnOn: { backgroundColor: colors.bar },
  toolText: { fontFamily: fonts.sansMedium, fontSize: 14, color: colors.ink },
  toolTextOn: { color: colors.white },
  swatches: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.line },
  swatchOn: { borderWidth: 3, borderColor: colors.bar },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  sliderName: { width: 82, fontFamily: fonts.sansMedium, fontSize: 13, color: colors.inkSoft },
  slider: { flex: 1, height: 36 },
  frame: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(29,78,137,0.55)', borderStyle: 'dashed', borderRadius: 4 },
  grip: { position: 'absolute', right: -12, bottom: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.bar },
  frameOn: { borderWidth: 2, borderStyle: 'solid', borderColor: colors.bar, backgroundColor: 'rgba(29,78,137,0.08)' },
  line: { position: 'absolute', borderWidth: 1.5, borderColor: colors.bar, backgroundColor: 'rgba(29,78,137,0.14)', borderRadius: 3 },
  input: {
    minHeight: 110,
    maxHeight: 220,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.md,
    fontFamily: fonts.sans,
    fontSize: 16,
    color: colors.ink,
  },
})
