import { create } from 'zustand'

type ProgressState = {
  byId: Record<string, number>
  set: (id: string, fraction: number) => void
  clear: (id: string) => void
}

export const useUploadProgress = create<ProgressState>((set) => ({
  byId: {},
  set: (id, fraction) => set((s) => ({ byId: { ...s.byId, [id]: fraction } })),
  clear: (id) =>
    set((s) => {
      const next = { ...s.byId }
      delete next[id]
      return { byId: next }
    }),
}))
