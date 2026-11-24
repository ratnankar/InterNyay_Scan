import { describe, expect, it } from 'vitest'
import { customId, fitCanvas, isCustom, pageSizeRatio } from '@/imaging/pageSizes'
import { orientedSize, replaceLine, simplifyPoints, textBounds, turnPoint, turnStrokes, turnTexts, type Stroke, type TextBox } from '@/imaging/marks'

describe('page sizes', () => {
  it('keeps the scan size for auto fit', () => {
    expect(fitCanvas(1000, 1400, null)).toEqual({ width: 1000, height: 1400 })
  })
  it('pads a landscape scan onto a portrait page without shrinking it', () => {
    const r = pageSizeRatio('a4p') as number
    const c = fitCanvas(2000, 1000, r)
    expect(c.width).toBe(2000)
    expect(c.width / c.height).toBeCloseTo(r, 6)
    expect(c.height).toBeGreaterThan(1000)
  })
  it('pads a tall scan onto a landscape page', () => {
    const r = pageSizeRatio('letterl') as number
    const c = fitCanvas(1000, 1500, r)
    expect(c.height).toBe(1500)
    expect(c.width / c.height).toBeCloseTo(r, 6)
  })
  it('landscape ratios are the inverse of portrait', () => {
    expect((pageSizeRatio('legalp') as number) * (pageSizeRatio('legall') as number)).toBeCloseTo(1, 9)
  })
})

describe('custom page size', () => {
  it('round-trips a ratio and clamps extremes', () => {
    expect(isCustom(customId(0.8))).toBe(true)
    expect(pageSizeRatio(customId(0.8))).toBeCloseTo(0.8, 3)
    expect(pageSizeRatio(customId(9))).toBe(2.5)
    expect(pageSizeRatio(customId(0.01))).toBe(0.4)
  })
})

describe('rotation of marks', () => {
  it('four quarter turns return a point to where it started', () => {
    let p = { x: 0.2, y: 0.7 }
    for (let i = 0; i < 4; i++) p = turnPoint(p.x, p.y)
    expect(p.x).toBeCloseTo(0.2, 9)
    expect(p.y).toBeCloseTo(0.7, 9)
  })
  it('moves the top-left corner to the top-right', () => {
    expect(turnPoint(0, 0)).toEqual({ x: 1, y: 0 })
  })
  it('turns strokes and text boxes together', () => {
    const s: Stroke = { kind: 'pen', color: '#000', width: 0.01, points: [0, 0, 1, 0] }
    expect(turnStrokes([s])[0].points).toEqual([1, 0, 1, 1])
    const t: TextBox = { id: 'a', text: 'x', cx: 0.25, cy: 0.5, size: 0.04, w: 0.3, color: '#000', bg: false, rot: 270 }
    const turned = turnTexts([t])[0]
    expect(turned.rot).toBe(0)
    expect(turned.cx).toBeCloseTo(0.5, 9)
    expect(turned.cy).toBeCloseTo(0.25, 9)
  })
  it('swaps oriented size for quarter rotations', () => {
    const page = { width: 1000, height: 1400, quad: null, rotation: 90 as const }
    expect(orientedSize(page)).toEqual({ width: 1400, height: 1000 })
  })
})

describe('text bounds', () => {
  it('swaps width and height when rotated a quarter turn', () => {
    const b = textBounds({ cx: 0.5, cy: 0.5, rot: 90 }, 1000, 2000, 400, 100)
    expect(b.width).toBe(100)
    expect(b.height).toBe(400)
    expect(b.x).toBe(450)
    expect(b.y).toBe(800)
  })
})

describe('simplifyPoints', () => {
  it('keeps the first and last point and drops near duplicates', () => {
    const out = simplifyPoints([0, 0, 0.001, 0, 0.002, 0, 0.5, 0, 0.501, 0, 1, 0], 0.01)
    expect(out.slice(0, 2)).toEqual([0, 0])
    expect(out.slice(-2)).toEqual([1, 0])
    expect(out.length).toBeLessThan(12)
  })
})

describe('replaceLine', () => {
  it('builds an erase band that covers the line and a text box centred on it', () => {
    const { erase, box } = replaceLine({ text: 'Hello', x: 100, y: 200, w: 400, h: 40 }, 1000, 1400, 1000, 1400, 'id1')
    expect(erase.kind).toBe('magic')
    expect(erase.points[1]).toBeCloseTo(220 / 1400, 6)
    expect(erase.points[0]).toBeLessThan(erase.points[2])
    expect(box.cx).toBeCloseTo(0.3, 6)
    expect(box.cy).toBeCloseTo(220 / 1400, 6)
    expect(box.text).toBe('Hello')
    expect(box.size).toBeGreaterThan(0)
  })
})
