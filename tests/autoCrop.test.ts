import { describe, expect, it } from 'vitest'
import { findDocumentQuad } from '../src/imaging/autoCrop'

function scene(width: number, height: number, inside: (x: number, y: number) => boolean): Uint8Array {
  const gray = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) gray[y * width + x] = inside(x, y) ? 225 : 40
  }
  return gray
}

describe('findDocumentQuad', () => {
  it('finds a bright rectangle on a dark background', () => {
    const w = 200
    const h = 280
    const gray = scene(w, h, (x, y) => x >= 30 && x <= 170 && y >= 40 && y <= 240)
    const q = findDocumentQuad(gray, w, h)
    expect(q).not.toBeNull()
    expect(q![0].x).toBeCloseTo(30, -1)
    expect(q![0].y).toBeCloseTo(40, -1)
    expect(q![2].x).toBeCloseTo(170, -1)
    expect(q![2].y).toBeCloseTo(240, -1)
  })

  it('finds the corners of a skewed page', () => {
    const w = 200
    const h = 280
    const gray = scene(w, h, (x, y) => {
      const left = 30 + (y - 30) * 0.1
      const right = 180 - (y - 30) * 0.05
      return y >= 30 && y <= 250 && x >= left && x <= right
    })
    const q = findDocumentQuad(gray, w, h)
    expect(q).not.toBeNull()
    expect(q![0].x).toBeLessThan(q![3].x + 40)
    expect(q![1].x).toBeGreaterThan(q![0].x + 100)
  })

  it('returns null when nothing stands out', () => {
    const gray = new Uint8Array(200 * 280).fill(180)
    expect(findDocumentQuad(gray, 200, 280)).toBeNull()
  })

  it('returns null when the page fills the whole frame', () => {
    const gray = scene(200, 280, () => true)
    expect(findDocumentQuad(gray, 200, 280)).toBeNull()
  })
})
