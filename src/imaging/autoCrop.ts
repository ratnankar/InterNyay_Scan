import { type Point, type Quad, polygonArea } from './geometry'

export function rgbaToGray(rgba: ArrayLike<number>, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height)
  for (let i = 0, j = 0; i < gray.length; i++, j += 4) {
    gray[i] = Math.round(0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2])
  }
  return gray
}

export function otsuThreshold(gray: Uint8Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++
  const total = gray.length
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let sumB = 0
  let weightB = 0
  let best = 0
  let threshold = 127
  for (let t = 0; t < 256; t++) {
    weightB += hist[t]
    if (weightB === 0) continue
    const weightF = total - weightB
    if (weightF === 0) break
    sumB += t * hist[t]
    const meanB = sumB / weightB
    const meanF = (sum - sumB) / weightF
    const between = weightB * weightF * (meanB - meanF) * (meanB - meanF)
    if (between > best) {
      best = between
      threshold = t
    }
  }
  return threshold
}

function largestComponent(mask: Uint8Array, width: number, height: number): Int32Array | null {
  const seen = new Uint8Array(mask.length)
  const stack = new Int32Array(mask.length)
  let best: number[] | null = null
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue
    const members: number[] = []
    let top = 0
    stack[top++] = start
    seen[start] = 1
    while (top > 0) {
      const idx = stack[--top]
      members.push(idx)
      const x = idx % width
      const y = (idx - x) / width
      if (x > 0 && mask[idx - 1] && !seen[idx - 1]) {
        seen[idx - 1] = 1
        stack[top++] = idx - 1
      }
      if (x < width - 1 && mask[idx + 1] && !seen[idx + 1]) {
        seen[idx + 1] = 1
        stack[top++] = idx + 1
      }
      if (y > 0 && mask[idx - width] && !seen[idx - width]) {
        seen[idx - width] = 1
        stack[top++] = idx - width
      }
      if (y < height - 1 && mask[idx + width] && !seen[idx + width]) {
        seen[idx + width] = 1
        stack[top++] = idx + width
      }
    }
    if (!best || members.length > best.length) best = members
  }
  return best ? Int32Array.from(best) : null
}

export function findDocumentQuad(gray: Uint8Array, width: number, height: number): Quad | null {
  const threshold = otsuThreshold(gray)
  const mask = new Uint8Array(gray.length)
  let bright = 0
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] > threshold) {
      mask[i] = 1
      bright++
    }
  }
  const coverage = bright / gray.length
  if (coverage < 0.12 || coverage > 0.97) return null

  const component = largestComponent(mask, width, height)
  if (!component || component.length < gray.length * 0.12) return null

  let tl: Point = { x: width, y: height }
  let tr: Point = { x: 0, y: height }
  let br: Point = { x: 0, y: 0 }
  let bl: Point = { x: width, y: 0 }
  let minSum = Infinity
  let maxSum = -Infinity
  let minDiff = Infinity
  let maxDiff = -Infinity

  for (let i = 0; i < component.length; i++) {
    const idx = component[i]
    const x = idx % width
    const y = (idx - x) / width
    const sum = x + y
    const diff = x - y
    if (sum < minSum) {
      minSum = sum
      tl = { x, y }
    }
    if (sum > maxSum) {
      maxSum = sum
      br = { x, y }
    }
    if (diff > maxDiff) {
      maxDiff = diff
      tr = { x, y }
    }
    if (diff < minDiff) {
      minDiff = diff
      bl = { x, y }
    }
  }

  const quad: Quad = [tl, tr, br, bl]
  const area = polygonArea(quad)
  if (area < width * height * 0.15 || area > width * height * 0.985) return null
  return quad
}
