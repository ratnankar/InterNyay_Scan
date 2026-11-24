import type { OcrLine } from '@/ocr/types'
import { isFullQuad, quadSize, type Quad } from './geometry'

// Everything here lives in "oriented content space": the page after crop, rotation and
// brightness/contrast, before it is placed on a paper size. Coordinates are 0..1 of the content
// width/height. Lengths (brush width, font size, text box width) are fractions of the content's
// shorter edge, so they stay the same when the page is rotated.

export type StrokeKind = 'pen' | 'highlight' | 'magic' | 'clean'

export type Stroke = {
  kind: StrokeKind
  color: string
  width: number
  points: number[] // x0, y0, x1, y1, ...
}

export type Rotation = 0 | 90 | 180 | 270

export type TextBox = {
  id: string
  text: string
  cx: number
  cy: number
  size: number
  w: number
  color: string
  bg: boolean
  rot: Rotation
}

export const PEN_COLORS = ['#14202E', '#D32F2F', '#1D4E89', '#2E7D32', '#F9A825', '#FFFFFF']
export const HIGHLIGHT_COLORS = ['#FFEB3B', '#69F0AE', '#FF80AB', '#80D8FF']
export const TEXT_COLORS = ['#000000', '#D32F2F', '#1D4E89', '#2E7D32', '#FFFFFF']

export function shortEdge(width: number, height: number): number {
  return Math.max(1, Math.min(width, height))
}

export function nextRotation(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation
}

export function orientedSize(
  page: { width: number; height: number; quad: Quad | null; rotation: Rotation },
): { width: number; height: number } {
  const full = !page.quad || isFullQuad(page.quad, page.width, page.height)
  const base = full || !page.quad ? { width: page.width, height: page.height } : quadSize(page.quad)
  return page.rotation === 90 || page.rotation === 270 ? { width: base.height, height: base.width } : base
}

// One clockwise quarter turn of the content, in normalized coordinates.
export function turnPoint(x: number, y: number): { x: number; y: number } {
  return { x: 1 - y, y: x }
}

export function turnStrokes(strokes: Stroke[]): Stroke[] {
  return strokes.map((s) => {
    const points: number[] = []
    for (let i = 0; i + 1 < s.points.length; i += 2) {
      const p = turnPoint(s.points[i], s.points[i + 1])
      points.push(p.x, p.y)
    }
    return { ...s, points }
  })
}

export function turnTexts(texts: TextBox[]): TextBox[] {
  return texts.map((t) => {
    const c = turnPoint(t.cx, t.cy)
    return { ...t, cx: c.x, cy: c.y, rot: nextRotation(t.rot) }
  })
}

// Bounding box of a text box in content pixels, given the laid-out size of its text.
export function textBounds(
  box: Pick<TextBox, 'cx' | 'cy' | 'rot'>,
  contentW: number,
  contentH: number,
  textW: number,
  textH: number,
): { x: number; y: number; width: number; height: number } {
  const swap = box.rot === 90 || box.rot === 270
  const width = swap ? textH : textW
  const height = swap ? textW : textH
  return { x: box.cx * contentW - width / 2, y: box.cy * contentH - height / 2, width, height }
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

// Thin out points that are closer together than `minDistance` (normalized units).
export function simplifyPoints(points: number[], minDistance: number): number[] {
  if (points.length <= 4) return points
  const out = [points[0], points[1]]
  for (let i = 2; i + 1 < points.length - 2; i += 2) {
    const dx = points[i] - out[out.length - 2]
    const dy = points[i + 1] - out[out.length - 1]
    if (Math.hypot(dx, dy) >= minDistance) out.push(points[i], points[i + 1])
  }
  out.push(points[points.length - 2], points[points.length - 1])
  return out
}

// Turns an OCR line (pixels of the rendered page) into an erase stroke plus a text box that
// replaces it, both in oriented content space.
export function replaceLine(
  line: OcrLine,
  imageW: number,
  imageH: number,
  contentW: number,
  contentH: number,
  id: string,
): { erase: Stroke; box: TextBox } {
  const short = shortEdge(contentW, contentH)
  const pad = line.h * 0.18
  const bandH = line.h + pad * 2
  const x0 = (line.x - pad) / imageW
  const x1 = (line.x + line.w + pad) / imageW
  const yc = (line.y + line.h / 2) / imageH
  const width = (bandH / imageH) * (contentH / short)
  const inset = bandH / 2 / imageW
  const left = Math.min(x0 + inset, (x0 + x1) / 2)
  const right = Math.max(x1 - inset, (x0 + x1) / 2)
  const erase: Stroke = { kind: 'magic', color: '#FFFFFF', width, points: [clamp01(left), clamp01(yc), clamp01(right), clamp01(yc)] }
  const box: TextBox = {
    id,
    text: line.text,
    cx: clamp01((line.x + line.w / 2) / imageW),
    cy: clamp01(yc),
    size: ((line.h * 0.82) / imageH) * (contentH / short),
    w: ((line.w * 1.04) / imageW) * (contentW / short),
    color: '#000000',
    bg: false,
    rot: 0,
  }
  return { erase, box }
}
