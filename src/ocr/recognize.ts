import TextRecognition, { TextRecognitionScript, type TextRecognitionResult } from '@react-native-ml-kit/text-recognition'
import { blocksToText, devanagariRatio } from './structure'
import type { OcrLanguage, OcrLine, OcrPage, OcrWord } from './types'

function toPage(result: TextRecognitionResult, width: number, height: number): OcrPage {
  const words: OcrWord[] = []
  for (const block of result.blocks) {
    for (const line of block.lines) {
      for (const element of line.elements) {
        const f = element.frame
        if (!f || element.text.trim().length === 0) continue
        words.push({ t: element.text, x: f.left, y: f.top, w: f.width, h: f.height })
      }
    }
  }
  const text = blocksToText(
    result.blocks.map(block => ({
      lines: block.lines.map(line => ({ text: line.text, width: line.frame?.width ?? 0 })),
    })),
  )
  return { width, height, words, text }
}

async function run(uri: string, script: TextRecognitionScript, width: number, height: number): Promise<OcrPage> {
  const result = await TextRecognition.recognize(uri, script)
  return toPage(result, width, height)
}

export async function recognizeImage(uri: string, width: number, height: number, language: OcrLanguage): Promise<OcrPage> {
  if (language === 'en') return run(uri, TextRecognitionScript.LATIN, width, height)
  if (language === 'hi') return run(uri, TextRecognitionScript.DEVANAGARI, width, height)
  const devanagari = await run(uri, TextRecognitionScript.DEVANAGARI, width, height)
  if (devanagariRatio(devanagari.text) >= 0.08) return devanagari
  return run(uri, TextRecognitionScript.LATIN, width, height)
}

export function languageLabel(pages: OcrPage[], requested: OcrLanguage): string {
  if (requested !== 'auto') return requested
  const text = pages.map(p => p.text).join(' ')
  return devanagariRatio(text) >= 0.08 ? 'hi' : 'en'
}

function toLines(result: TextRecognitionResult): OcrLine[] {
  const lines: OcrLine[] = []
  for (const block of result.blocks) {
    for (const line of block.lines) {
      const f = line.frame
      const text = line.text.trim()
      if (!f || text.length === 0) continue
      lines.push({ text, x: f.left, y: f.top, w: f.width, h: f.height })
    }
  }
  return lines
}

export async function recognizeLines(uri: string, language: OcrLanguage): Promise<OcrLine[]> {
  if (language === 'en') return toLines(await TextRecognition.recognize(uri, TextRecognitionScript.LATIN))
  if (language === 'hi') return toLines(await TextRecognition.recognize(uri, TextRecognitionScript.DEVANAGARI))
  const devanagari = await TextRecognition.recognize(uri, TextRecognitionScript.DEVANAGARI)
  if (devanagariRatio(devanagari.text) >= 0.08) return toLines(devanagari)
  return toLines(await TextRecognition.recognize(uri, TextRecognitionScript.LATIN))
}
