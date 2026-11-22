import { queryClient } from '@/api/queryClient'
import type { Doc } from '@/api/types'
import { uploadPending } from './pending'
import { useUploadProgress } from './progress'

const active = new Set<string>()

export function isUploading(id: string): boolean {
  return active.has(id)
}

export async function runUpload(id: string): Promise<Doc> {
  if (active.has(id)) throw new Error('This scan is already uploading.')
  active.add(id)
  useUploadProgress.getState().set(id, 0)
  void queryClient.invalidateQueries({ queryKey: ['pending'] })
  try {
    const doc = await uploadPending(id, (f) => useUploadProgress.getState().set(id, f))
    void queryClient.invalidateQueries({ queryKey: ['scans'] })
    void queryClient.invalidateQueries({ queryKey: ['documents'] })
    return doc
  } finally {
    active.delete(id)
    useUploadProgress.getState().clear(id)
    void queryClient.invalidateQueries({ queryKey: ['pending'] })
  }
}
