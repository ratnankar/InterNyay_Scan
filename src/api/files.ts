import { Directory, File, Paths } from 'expo-file-system'
import { buildUrl, handleSession, messageFrom, ApiError } from './http'
import { getToken } from '@/auth/token'
import { safeFileName } from '@/utils/format'
import type { Doc } from './types'

export function downloadsDir(): Directory {
  const dir = new Directory(Paths.cache, 'downloads')
  if (!dir.exists) dir.create({ intermediates: true })
  return dir
}

export async function downloadDocument(doc: Doc): Promise<File> {
  const token = await getToken()
  const url = buildUrl(`/documents/${doc.id}/download`)
  const base = safeFileName(doc.name)
  const name = base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
  const target = new File(downloadsDir(), `${doc.id.slice(0, 8)}-${name}`)
  if (target.exists) target.delete()
  try {
    return await File.downloadFileAsync(url, target, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch (e) {
    if (target.exists) target.delete()
    const message = e instanceof Error ? e.message : ''
    if (/401/.test(message)) {
      await handleSession(401, !!token, '/documents')
      throw new ApiError(401, 'Your session has expired. Please sign in again.')
    }
    throw new ApiError(0, message.length > 0 ? 'The document could not be downloaded.' : 'Download failed.')
  }
}

export function clearDownloads() {
  const dir = new Directory(Paths.cache, 'downloads')
  if (dir.exists) dir.delete()
}

export { messageFrom }
