export type Point = { x: number; y: number }
export type Quad = [Point, Point, Point, Point]

export function rectQuad(width: number, height: number): Quad {
  return [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

export function quadSize(q: Quad): { width: number; height: number } {
  const width = Math.max(distance(q[0], q[1]), distance(q[3], q[2]))
  const height = Math.max(distance(q[0], q[3]), distance(q[1], q[2]))
  return { width: Math.max(1, width), height: Math.max(1, height) }
}

export function isFullQuad(q: Quad, width: number, height: number, tolerance = 0.01): boolean {
  const full = rectQuad(width, height)
  const limit = Math.max(width, height) * tolerance
  return q.every((p, i) => distance(p, full[i]) <= limit)
}

export function clampQuad(q: Quad, width: number, height: number): Quad {
  const clamp = (p: Point): Point => ({
    x: Math.min(width, Math.max(0, p.x)),
    y: Math.min(height, Math.max(0, p.y)),
  })
  return [clamp(q[0]), clamp(q[1]), clamp(q[2]), clamp(q[3])]
}

export function scaleQuad(q: Quad, sx: number, sy: number): Quad {
  const s = (p: Point): Point => ({ x: p.x * sx, y: p.y * sy })
  return [s(q[0]), s(q[1]), s(q[2]), s(q[3])]
}

export function polygonArea(points: Point[]): number {
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

export function solveHomography(from: Quad, to: Quad): number[] {
  const a: number[][] = []
  const b: number[] = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = from[i]
    const { x: u, y: v } = to[i]
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y])
    b.push(u)
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y])
    b.push(v)
  }
  const n = 8
  for (let col = 0; col < n; col++) {
    let pivot = col
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r
    }
    if (Math.abs(a[pivot][col]) < 1e-9) throw new Error('Degenerate crop area')
    ;[a[col], a[pivot]] = [a[pivot], a[col]]
    ;[b[col], b[pivot]] = [b[pivot], b[col]]
    for (let r = col + 1; r < n; r++) {
      const f = a[r][col] / a[col][col]
      for (let c = col; c < n; c++) a[r][c] -= f * a[col][c]
      b[r] -= f * b[col]
    }
  }
  const x = new Array<number>(n).fill(0)
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]
    for (let c = r + 1; c < n; c++) s -= a[r][c] * x[c]
    x[r] = s / a[r][r]
  }
  return [x[0], x[1], x[2], x[3], x[4], x[5], x[6], x[7], 1]
}

export function applyHomography(h: number[], p: Point): Point {
  const w = h[6] * p.x + h[7] * p.y + h[8]
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w }
}

export function toColumnMajor(h: number[]): number[] {
  return [h[0], h[3], h[6], h[1], h[4], h[7], h[2], h[5], h[8]]
}
