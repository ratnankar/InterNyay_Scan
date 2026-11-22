import { Canvas, Path, Skia } from '@shopify/react-native-skia'
import { router, useLocalSearchParams } from 'expo-router'
import { useMemo, useRef, useState } from 'react'
import { Alert, Image, LayoutChangeEvent, PanResponder, StyleSheet, View } from 'react-native'
import { Button, Header, Screen } from '@/components/ui'
import { clampQuad, polygonArea, rectQuad, solveHomography, type Quad } from '@/imaging/geometry'
import { detectQuad } from '@/imaging/render'
import { useDraft } from '@/store/draft'
import { colors, space } from '@/theme'

const HANDLE = 34

export default function Crop() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const page = useDraft((s) => s.pages.find((p) => p.id === id))
  const updatePage = useDraft((s) => s.updatePage)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [quad, setQuad] = useState<Quad>(() => (page ? (page.quad ?? rectQuad(page.width, page.height)) : rectQuad(1, 1)))
  const [busy, setBusy] = useState(false)

  const quadRef = useRef(quad)
  quadRef.current = quad
  const geometry = useMemo(() => {
    if (!page || box.w === 0) return { scale: 1, ox: 0, oy: 0 }
    const scale = Math.min(box.w / page.width, box.h / page.height)
    return { scale, ox: (box.w - page.width * scale) / 2, oy: (box.h - page.height * scale) / 2 }
  }, [page, box])
  const geoRef = useRef(geometry)
  geoRef.current = geometry

  const responders = useMemo(
    () =>
      [0, 1, 2, 3].map((i) => {
        let start = { x: 0, y: 0 }
        return PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onPanResponderGrant: () => {
            start = { ...quadRef.current[i] }
          },
          onPanResponderMove: (_, g) => {
            if (!page) return
            const s = geoRef.current.scale
            const next = [...quadRef.current] as Quad
            next[i] = { x: start.x + g.dx / s, y: start.y + g.dy / s }
            setQuad(clampQuad(next, page.width, page.height))
          },
        })
      }),
    [page],
  )

  if (!page) return <Screen>{null}</Screen>

  const toScreen = (p: { x: number; y: number }) => ({ x: geometry.ox + p.x * geometry.scale, y: geometry.oy + p.y * geometry.scale })
  const pts = quad.map(toScreen)

  const outline = Skia.PathBuilder.Make()
    .moveTo(pts[0].x, pts[0].y)
    .lineTo(pts[1].x, pts[1].y)
    .lineTo(pts[2].x, pts[2].y)
    .lineTo(pts[3].x, pts[3].y)
    .close()
    .build()

  const auto = async () => {
    setBusy(true)
    try {
      const found = await detectQuad(page.sourceUri)
      if (found) setQuad(clampQuad(found, page.width, page.height))
      else Alert.alert('Edges not found', 'Drag the corners to the edges of the page.')
    } catch {
      Alert.alert('Edges not found', 'Drag the corners to the edges of the page.')
    } finally {
      setBusy(false)
    }
  }

  const apply = () => {
    if (polygonArea(quad) < page.width * page.height * 0.04) {
      Alert.alert('Crop area is too small')
      return
    }
    try {
      solveHomography(rectQuad(100, 100), quad)
    } catch {
      Alert.alert('Crop corners are not valid', 'Move the corners so they form a four-sided shape.')
      return
    }
    updatePage(page.id, { quad })
    router.back()
  }

  const onLayout = (e: LayoutChangeEvent) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Crop" onBack={() => router.back()} />
      <View style={styles.stage} onLayout={onLayout}>
        <Image source={{ uri: page.sourceUri }} style={styles.image} resizeMode="contain" />
        <Canvas style={styles.overlay} pointerEvents="none">
          <Path path={outline} color="rgba(29,78,137,0.14)" style="fill" />
          <Path path={outline} color={colors.bar} style="stroke" strokeWidth={2.5} />
        </Canvas>
        {pts.map((p, i) => (
          <View
            key={i}
            {...responders[i].panHandlers}
            style={[styles.handleHit, { left: p.x - HANDLE, top: p.y - HANDLE }]}
            accessibilityLabel={`Corner ${i + 1}`}
          >
            <View style={styles.handle} />
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        <Button label="Auto" icon="maximize" variant="secondary" loading={busy} onPress={() => void auto()} style={styles.flex} />
        <Button label="Reset" variant="secondary" onPress={() => setQuad(rectQuad(page.width, page.height))} style={styles.flex} />
        <Button label="Apply" onPress={apply} style={styles.flex} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: space.lg, backgroundColor: '#E7EBEF', borderRadius: 12 },
  image: StyleSheet.absoluteFill,
  overlay: StyleSheet.absoluteFill,
  handleHit: { position: 'absolute', width: HANDLE * 2, height: HANDLE * 2, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, borderWidth: 3, borderColor: colors.bar },
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.lg },
  flex: { flex: 1 },
})
