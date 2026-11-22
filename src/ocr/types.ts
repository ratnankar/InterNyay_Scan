export type OcrLanguage = 'auto' | 'en' | 'hi'

export type OcrWord = { t: string; x: number; y: number; w: number; h: number }

export type OcrPage = { width: number; height: number; words: OcrWord[]; text: string }

export type OcrPayload = {
  language: string
  confidence: number | null
  text: string
  pages: { width: number; height: number; words: OcrWord[] }[]
}
