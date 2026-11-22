import { create } from 'zustand'
import { File } from 'expo-file-system'
import { clearImageCache, forgetImage } from '@/imaging/render'
import { deleteDraftDir } from '@/pipeline/importPages'
import type { EditPage } from '@/pipeline/types'
import type { OcrLanguage, OcrPage } from '@/ocr/types'
import type { QualityId } from '@/constants'
import { MAX_PAGES } from '@/constants'
import { defaultScanName, newId } from '@/utils/format'

export type Target = {
  clientId: number | null
  clientName: string | null
  caseId: number | null
  caseTitle: string | null
}

export type Prepared = {
  key: string
  files: { uri: string; width: number; height: number }[]
  ocr: OcrPage[]
  language: string
  failedPages: number
}

type DraftState = {
  sessionId: string
  pages: EditPage[]
  selectedId: string | null
  target: Target
  name: string
  category: string
  ocrEnabled: boolean
  text: string
  textEdited: boolean
  prepared: Prepared | null
  addPages: (pages: EditPage[]) => void
  replacePage: (id: string, page: EditPage) => void
  updatePage: (id: string, patch: Partial<EditPage>) => void
  applyToAll: (patch: Partial<EditPage>) => void
  removePage: (id: string) => void
  movePage: (id: string, direction: -1 | 1) => void
  select: (id: string) => void
  setTarget: (target: Partial<Target>) => void
  setName: (name: string) => void
  setCategory: (category: string) => void
  setOcrEnabled: (value: boolean) => void
  setText: (text: string, edited: boolean) => void
  setPrepared: (prepared: Prepared | null) => void
  reset: () => void
}

const emptyTarget: Target = { clientId: null, clientName: null, caseId: null, caseTitle: null }

function fresh() {
  return {
    sessionId: newId(),
    pages: [] as EditPage[],
    selectedId: null as string | null,
    target: emptyTarget,
    name: defaultScanName(),
    category: 'Other',
    ocrEnabled: true,
    text: '',
    textEdited: false,
    prepared: null as Prepared | null,
  }
}

function dropFile(uri: string) {
  forgetImage(uri)
  try {
    const f = new File(uri)
    if (f.exists) f.delete()
  } catch {
    return
  }
}

export const useDraft = create<DraftState>((set, get) => ({
  ...fresh(),
  addPages: (pages) =>
    set((s) => {
      const room = Math.max(0, MAX_PAGES - s.pages.length)
      const next = [...s.pages, ...pages.slice(0, room)]
      return { pages: next, selectedId: s.selectedId ?? next[0]?.id ?? null, prepared: null }
    }),
  replacePage: (id, page) =>
    set((s) => {
      const old = s.pages.find((p) => p.id === id)
      if (old) dropFile(old.sourceUri)
      return { pages: s.pages.map((p) => (p.id === id ? page : p)), selectedId: page.id, prepared: null }
    }),
  updatePage: (id, patch) =>
    set((s) => ({
      pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch, rev: p.rev + 1 } : p)),
      prepared: null,
    })),
  applyToAll: (patch) =>
    set((s) => ({ pages: s.pages.map((p) => ({ ...p, ...patch, rev: p.rev + 1 })), prepared: null })),
  removePage: (id) =>
    set((s) => {
      const old = s.pages.find((p) => p.id === id)
      if (old) dropFile(old.sourceUri)
      const next = s.pages.filter((p) => p.id !== id)
      const selectedId = s.selectedId === id ? (next[0]?.id ?? null) : s.selectedId
      return { pages: next, selectedId, prepared: null }
    }),
  movePage: (id, direction) =>
    set((s) => {
      const index = s.pages.findIndex((p) => p.id === id)
      const target = index + direction
      if (index < 0 || target < 0 || target >= s.pages.length) return s
      const next = [...s.pages]
      ;[next[index], next[target]] = [next[target], next[index]]
      return { pages: next, prepared: null }
    }),
  select: (id) => set({ selectedId: id }),
  setTarget: (target) => set((s) => ({ target: { ...s.target, ...target } })),
  setName: (name) => set({ name }),
  setCategory: (category) => set({ category }),
  setOcrEnabled: (value) => set({ ocrEnabled: value, prepared: null }),
  setText: (text, edited) => set({ text, textEdited: edited }),
  setPrepared: (prepared) => set({ prepared }),
  reset: () => {
    const { sessionId } = get()
    clearImageCache()
    deleteDraftDir(sessionId)
    set(fresh())
  },
}))

export function preparedKey(pages: EditPage[], quality: QualityId, language: OcrLanguage, ocr: boolean): string {
  return JSON.stringify({
    q: quality,
    l: language,
    o: ocr,
    p: pages.map((p) => [p.id, p.rev]),
  })
}
