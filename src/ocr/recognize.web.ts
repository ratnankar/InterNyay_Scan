import { devanagariRatio } from './structure'
import type { OcrLanguage, OcrPage } from './types'

export async function recognizeImage(_uri: string, width: number, height: number, _language: OcrLanguage): Promise<OcrPage> {
  return { width, height, words: [], text: '' }
}

export function languageLabel(pages: OcrPage[], requested: OcrLanguage): string {
  if (requested !== 'auto') return requested
  const text = pages.map((p) => p.text).join(' ')
  return devanagariRatio(text) >= 0.08 ? 'hi' : 'en'
}
