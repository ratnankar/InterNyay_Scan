import { API_BASE, ApiError, handleSession } from '@/api/http'
import type { Doc } from '@/api/types'
import { getToken, setToken } from '@/auth/token'

export type ScanUpload = {
  uploadId: string
  name: string
  category: string
  clientId: number | null
  caseId: number | null
  pages: string[]
  ocrJson: string | null
}

export function postScan(
  upload: ScanUpload,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<Doc> {
  return new Promise(async (resolve, reject) => {
    if (!API_BASE) {
      reject(new ApiError(0, 'The InterNyay server address is not configured.'))
      return
    }
    const token = await getToken()
    const form = new FormData()
    form.append('uploadId', upload.uploadId)
    form.append('name', upload.name)
    form.append('type', upload.category)
    if (upload.caseId !== null) form.append('caseId', String(upload.caseId))
    if (upload.clientId !== null) form.append('clientId', String(upload.clientId))
    if (upload.ocrJson) form.append('ocr', upload.ocrJson)
    upload.pages.forEach((uri, i) => {
      form.append('pages', { uri, name: `page-${i + 1}.jpg`, type: 'image/jpeg' } as unknown as Blob)
    })

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/documents/scan`)
    xhr.setRequestHeader('Accept', 'application/json')
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.timeout = 240000

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total)
    }
    xhr.onerror = () => reject(new ApiError(0, 'Cannot reach InterNyay. Check your internet connection.'))
    xhr.ontimeout = () => reject(new ApiError(0, 'The upload timed out. Please try again.'))
    xhr.onabort = () => reject(new ApiError(0, 'The upload was cancelled.'))
    xhr.onload = async () => {
      const renewed = xhr.getResponseHeader('X-Refreshed-Token')
      if (renewed && token) await setToken(renewed)
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as Doc)
        } catch {
          reject(new ApiError(xhr.status, 'The server sent an unexpected response.'))
        }
        return
      }
      await handleSession(xhr.status, !!token, '/documents/scan')
      let message = ''
      try {
        message = JSON.parse(xhr.responseText).message ?? ''
      } catch {
        message = ''
      }
      reject(new ApiError(xhr.status, message || uploadFallback(xhr.status)))
    }

    signal?.addEventListener('abort', () => xhr.abort())
    xhr.send(form)
  })
}

function uploadFallback(status: number): string {
  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'Your plan or role does not allow uploading documents.'
  if (status === 404) return 'The selected client or case was not found.'
  if (status === 413) return 'The scan is too large. Choose a smaller PDF quality.'
  if (status === 429) return 'Too many requests. Please wait a moment.'
  return 'The upload failed. Please try again.'
}
