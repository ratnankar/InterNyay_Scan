import { create } from 'zustand'
import { kvGet, kvSet } from '@/db'
import type { OcrLanguage } from '@/ocr/types'
import type { QualityId } from '@/constants'

type SettingsState = {
  loaded: boolean
  language: OcrLanguage
  quality: QualityId
  load: () => Promise<void>
  setLanguage: (value: OcrLanguage) => void
  setQuality: (value: QualityId) => void
}

const LANGUAGES: OcrLanguage[] = ['auto', 'en', 'hi']
const QUALITIES: QualityId[] = ['high', 'balanced', 'small']

export const useSettings = create<SettingsState>((set) => ({
  loaded: false,
  language: 'auto',
  quality: 'balanced',
  load: async () => {
    const language = await kvGet('ocrLanguage')
    const quality = await kvGet('quality')
    set({
      loaded: true,
      language: LANGUAGES.includes(language as OcrLanguage) ? (language as OcrLanguage) : 'auto',
      quality: QUALITIES.includes(quality as QualityId) ? (quality as QualityId) : 'balanced',
    })
  },
  setLanguage: (value) => {
    set({ language: value })
    void kvSet('ocrLanguage', value)
  },
  setQuality: (value) => {
    set({ quality: value })
    void kvSet('quality', value)
  },
}))
