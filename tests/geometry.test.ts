import { describe, expect, it } from 'vitest'
import { applyHomography, isFullQuad, quadSize, rectQuad, solveHomography, toColumnMajor, type Quad } from '../src/imaging/geometry'

describe('homography', () => {
  const quad: Quad = [
    { x: 120, y: 80 },
    { x: 900, y: 140 },
    { x: 860, y: 1200 },
    { x: 60, y: 1100 },
  ]

  it('maps output corners onto the source quad', () => {
    const h = solveHomography(rectQuad(800, 1000), quad)
    const out = [
      applyHomography(h, { x: 0, y: 0 }),
      applyHomography(h, { x: 800, y: 0 }),
      applyHomography(h, { x: 800, y: 1000 }),
      applyHomography(h, { x: 0, y: 1000 }),
    ]
    out.forEach((p, i) => {
      expect(p.x).toBeCloseTo(quad[i].x, 4)
      expect(p.y).toBeCloseTo(quad[i].y, 4)
    })
  })

  it('maps the centre inside the quad', () => {
    const h = solveHomography(rectQuad(800, 1000), quad)
    const c = applyHomography(h, { x: 400, y: 500 })
    expect(c.x).toBeGreaterThan(200)
    expect(c.x).toBeLessThan(800)
    expect(c.y).toBeGreaterThan(200)
    expect(c.y).toBeLessThan(1100)
  })

  it('is the identity for a full rectangle', () => {
    const h = solveHomography(rectQuad(500, 700), rectQuad(500, 700))
    const p = applyHomography(h, { x: 123, y: 456 })
    expect(p.x).toBeCloseTo(123, 6)
    expect(p.y).toBeCloseTo(456, 6)
  })

  it('rejects a degenerate quad', () => {
    const flat: Quad = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
    ]
    expect(() => solveHomography(rectQuad(100, 100), flat)).toThrow()
  })

  it('orders uniform values column-major', () => {
    expect(toColumnMajor([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual([1, 4, 7, 2, 5, 8, 3, 6, 9])
  })
})

describe('quad helpers', () => {
  it('detects a full quad within tolerance', () => {
    expect(isFullQuad(rectQuad(1000, 1400), 1000, 1400)).toBe(true)
    const inset: Quad = [
      { x: 80, y: 80 },
      { x: 920, y: 80 },
      { x: 920, y: 1320 },
      { x: 80, y: 1320 },
    ]
    expect(isFullQuad(inset, 1000, 1400)).toBe(false)
  })

  it('measures quad size by the longer opposite edges', () => {
    const s = quadSize(rectQuad(300, 400))
    expect(s.width).toBe(300)
    expect(s.height).toBe(400)
  })
})
