import { useCallback, useEffect, useState } from 'react'

export const PAGE_SIZE = 20

// Shows the first `pageSize` items and reveals more as the person scrolls. Starts over when resetKey changes.
export function usePaged<T>(items: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [count, setCount] = useState(pageSize)

  useEffect(() => {
    setCount(pageSize)
  }, [resetKey, pageSize])

  const hasMore = count < items.length
  const loadMore = useCallback(() => {
    setCount((c) => c + pageSize)
  }, [pageSize])

  return { visible: items.slice(0, count), hasMore, loadMore }
}
