export type FilterId = 'original' | 'auto' | 'document' | 'bw' | 'gray' | 'color'

export const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'original', label: 'Original' },
  { id: 'auto', label: 'Auto' },
  { id: 'document', label: 'Document' },
  { id: 'bw', label: 'Black & White' },
  { id: 'gray', label: 'Grayscale' },
  { id: 'color', label: 'Color' },
]

export function colorMatrix(brightness: number, contrast: number, saturation: number): number[] {
  const lr = 0.299
  const lg = 0.587
  const lb = 0.114
  const s = saturation
  const c = contrast
  const o = 0.5 - 0.5 * c + brightness
  const rr = lr * (1 - s) + s
  const gg = lg * (1 - s) + s
  const bb = lb * (1 - s) + s
  return [
    c * rr, c * lg * (1 - s), c * lb * (1 - s), 0, o,
    c * lr * (1 - s), c * gg, c * lb * (1 - s), 0, o,
    c * lr * (1 - s), c * lg * (1 - s), c * bb, 0, o,
    0, 0, 0, 1, 0,
  ]
}

export function adjustmentToParams(brightness: number, contrast: number): { b: number; c: number } {
  return { b: (brightness / 50) * 0.25, c: 1 + (contrast / 50) * 0.4 }
}

export function filterColorParams(filter: FilterId): { saturation: number; contrast: number; brightness: number } | null {
  switch (filter) {
    case 'auto':
      return { saturation: 1.08, contrast: 1.12, brightness: 0.02 }
    case 'gray':
      return { saturation: 0, contrast: 1.1, brightness: 0 }
    case 'color':
      return { saturation: 1.35, contrast: 1.12, brightness: 0 }
    default:
      return null
  }
}
