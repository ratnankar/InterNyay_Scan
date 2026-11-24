import { useEffect, useRef, useState } from 'react'
import type { EditPage } from '@/pipeline/types'
import { renderPage } from './render'

const memo = new Map<string, string>()
const MEMO_LIMIT = 60

function keyOf(page: EditPage, edge: number, variant: string) {
  return `${page.id}:${page.rev}:${edge}:${page.pageSize}:${variant}`
}

export type Preview = { uri: string | null; busy: boolean; error: boolean; rev: number | null }

// `variant` separates previews of the same page that differ only by what the caller changed
// locally (for example an editor's unsaved strokes).
export function usePreview(page: EditPage | undefined, maxEdge: number, delay = 120, variant = ''): Preview {
  const [uri, setUri] = useState<string | null>(page ? (memo.get(keyOf(page, maxEdge, variant)) ?? null) : null)
  const [shownRev, setShownRev] = useState<number | null>(page && memo.has(keyOf(page, maxEdge, variant)) ? page.rev : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const run = useRef(0)

  useEffect(() => {
    if (!page) {
      setUri(null)
      return
    }
    const key = keyOf(page, maxEdge, variant)
    const cached = memo.get(key)
    if (cached) {
      setUri(cached)
      setShownRev(page.rev)
      setBusy(false)
      return
    }
    const token = ++run.current
    setBusy(true)
    setError(false)
    const timer = setTimeout(async () => {
      try {
        const rendered = await renderPage(page, maxEdge, 72)
        const data = `data:image/jpeg;base64,${rendered.base64}`
        memo.set(key, data)
        while (memo.size > MEMO_LIMIT) {
          const oldest = memo.keys().next().value
          if (oldest === undefined) break
          memo.delete(oldest)
        }
        if (run.current === token) {
          setUri(data)
          setShownRev(page.rev)
          setBusy(false)
        }
      } catch {
        if (run.current === token) {
          setError(true)
          setBusy(false)
        }
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [page, maxEdge, delay, variant])

  return { uri, busy, error, rev: shownRev }
}

export function clearPreviewMemo() {
  memo.clear()
}
