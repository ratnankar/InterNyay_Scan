export type CustomSizeId = `custom:${number}`

export type PageSizeId = CustomSizeId | 'auto' | 'a4p' | 'a4l' | 'a3p' | 'a3l' | 'a5p' | 'a5l' | 'letterp' | 'letterl' | 'legalp' | 'legall'

export type PageSizeOption = { id: PageSizeId; label: string; ratio: number | null }

const A = 210 / 297
const LETTER = 8.5 / 11
const LEGAL = 8.5 / 14

// ratio is width / height; null means "match the scan".
export const PAGE_SIZES: PageSizeOption[] = [
  { id: 'auto', label: 'Auto fit', ratio: null },
  { id: 'a4p', label: 'A4 portrait', ratio: A },
  { id: 'a4l', label: 'A4 landscape', ratio: 1 / A },
  { id: 'a3p', label: 'A3 portrait', ratio: A },
  { id: 'a3l', label: 'A3 landscape', ratio: 1 / A },
  { id: 'a5p', label: 'A5 portrait', ratio: A },
  { id: 'a5l', label: 'A5 landscape', ratio: 1 / A },
  { id: 'letterp', label: 'US letter portrait', ratio: LETTER },
  { id: 'letterl', label: 'US letter landscape', ratio: 1 / LETTER },
  { id: 'legalp', label: 'US legal portrait', ratio: LEGAL },
  { id: 'legall', label: 'US legal landscape', ratio: 1 / LEGAL },
]

export const MIN_RATIO = 0.4
export const MAX_RATIO = 2.5

export function customId(ratio: number): CustomSizeId {
  const r = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
  return `custom:${Math.round(r * 1000) / 1000}`
}

export function isCustom(id: PageSizeId): id is CustomSizeId {
  return id.startsWith('custom:')
}

export function pageSizeRatio(id: PageSizeId): number | null {
  if (isCustom(id)) {
    const r = Number(id.slice(7))
    return Number.isFinite(r) && r > 0 ? Math.min(MAX_RATIO, Math.max(MIN_RATIO, r)) : null
  }
  return PAGE_SIZES.find((p) => p.id === id)?.ratio ?? null
}

export function pageSizeLabel(id: PageSizeId): string {
  if (isCustom(id)) return 'Custom'
  return PAGE_SIZES.find((p) => p.id === id)?.label ?? 'Auto fit'
}

// Smallest canvas with the given aspect ratio that contains the content at its own size.
export function fitCanvas(contentW: number, contentH: number, ratio: number | null): { width: number; height: number } {
  if (ratio === null || !(ratio > 0)) return { width: contentW, height: contentH }
  if (contentW / contentH > ratio) return { width: contentW, height: contentW / ratio }
  return { width: contentH * ratio, height: contentH }
}
