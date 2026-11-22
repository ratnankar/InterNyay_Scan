import { Directory, File, Paths } from 'expo-file-system'
import { getDb } from '@/db'
import type { OcrPayload } from '@/ocr/types'
import type { Doc } from '@/api/types'
import { ApiError } from '@/api/http'
import { postScan } from './xhr'
import { draftsRoot } from '@/pipeline/importPages'

export type ScanRow = {
  id: string
  name: string
  category: string
  clientId: number | null
  clientName: string | null
  caseId: number | null
  caseTitle: string | null
  pageCount: number
  status: 'UPLOADING' | 'FAILED' | 'UPLOADED'
  ocrStatus: 'NONE' | 'DONE' | 'PARTIAL'
  error: string | null
  createdAt: string
  updatedAt: string
  serverId: string | null
}

type Raw = {
  id: string
  name: string
  category: string
  client_id: number | null
  client_name: string | null
  case_id: number | null
  case_title: string | null
  page_count: number
  status: ScanRow['status']
  ocr_status: ScanRow['ocrStatus']
  error: string | null
  created_at: string
  updated_at: string
  server_id: string | null
}

const map = (r: Raw): ScanRow => ({
  id: r.id,
  name: r.name,
  category: r.category,
  clientId: r.client_id,
  clientName: r.client_name,
  caseId: r.case_id,
  caseTitle: r.case_title,
  pageCount: r.page_count,
  status: r.status,
  ocrStatus: r.ocr_status,
  error: r.error,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  serverId: r.server_id,
})

function pendingRoot(): Directory {
  const dir = new Directory(Paths.cache, 'pending')
  if (!dir.exists) dir.create({ intermediates: true })
  return dir
}

function pendingDir(id: string): Directory {
  return new Directory(pendingRoot(), id)
}

export type EnqueueInput = {
  id: string
  name: string
  category: string
  clientId: number | null
  clientName: string | null
  caseId: number | null
  caseTitle: string | null
  pageUris: string[]
  ocr: OcrPayload | null
  ocrStatus: ScanRow['ocrStatus']
}

export async function enqueue(input: EnqueueInput): Promise<void> {
  const dir = pendingDir(input.id)
  if (dir.exists) dir.delete()
  dir.create({ intermediates: true })
  for (let i = 0; i < input.pageUris.length; i++) {
    await new File(input.pageUris[i]).copy(new File(dir, `page-${i + 1}.jpg`))
  }
  if (input.ocr) {
    const f = new File(dir, 'ocr.json')
    f.create()
    await f.write(JSON.stringify(input.ocr))
  }
  const now = new Date().toISOString()
  const db = await getDb()
  await db.runAsync(
    `INSERT OR REPLACE INTO scans (id, name, category, client_id, client_name, case_id, case_title, page_count, status, ocr_status, error, created_at, updated_at, server_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'UPLOADING', ?, NULL, ?, ?, NULL)`,
    input.id,
    input.name,
    input.category,
    input.clientId,
    input.clientName,
    input.caseId,
    input.caseTitle,
    input.pageUris.length,
    input.ocrStatus,
    now,
    now,
  )
}

export async function getRow(id: string): Promise<ScanRow | null> {
  const db = await getDb()
  const row = await db.getFirstAsync<Raw>('SELECT * FROM scans WHERE id = ?', id)
  return row ? map(row) : null
}

export async function listRows(): Promise<ScanRow[]> {
  const db = await getDb()
  const rows = await db.getAllAsync<Raw>('SELECT * FROM scans ORDER BY created_at DESC')
  return rows.map(map)
}

async function setStatus(id: string, status: ScanRow['status'], error: string | null, serverId: string | null) {
  const db = await getDb()
  await db.runAsync(
    'UPDATE scans SET status = ?, error = ?, server_id = COALESCE(?, server_id), updated_at = ? WHERE id = ?',
    status,
    error,
    serverId,
    new Date().toISOString(),
    id,
  )
}

export async function uploadPending(id: string, onProgress: (fraction: number) => void): Promise<Doc> {
  const row = await getRow(id)
  if (!row) throw new ApiError(404, 'This scan is no longer on this device.')
  const dir = pendingDir(id)
  if (!dir.exists) {
    await setStatus(id, 'FAILED', 'The scan files are no longer on this device.', null)
    throw new ApiError(404, 'The scan files are no longer on this device.')
  }

  const pages: string[] = []
  for (let i = 1; i <= row.pageCount; i++) {
    const f = new File(dir, `page-${i}.jpg`)
    if (!f.exists) {
      await setStatus(id, 'FAILED', 'Some scan pages are missing from this device.', null)
      throw new ApiError(404, 'Some scan pages are missing from this device.')
    }
    pages.push(f.uri)
  }
  const ocrFile = new File(dir, 'ocr.json')
  const ocrJson = ocrFile.exists ? await ocrFile.text() : null

  await setStatus(id, 'UPLOADING', null, null)
  try {
    const doc = await postScan(
      {
        uploadId: id,
        name: row.name,
        category: row.category,
        clientId: row.clientId,
        caseId: row.caseId,
        pages,
        ocrJson,
      },
      onProgress,
    )
    await setStatus(id, 'UPLOADED', null, doc.id)
    if (dir.exists) dir.delete()
    return doc
  } catch (e) {
    const message = e instanceof Error ? e.message : 'The upload failed.'
    await setStatus(id, 'FAILED', message, null)
    throw e
  }
}

export async function discardPending(id: string): Promise<void> {
  const dir = pendingDir(id)
  if (dir.exists) dir.delete()
  const db = await getDb()
  await db.runAsync('DELETE FROM scans WHERE id = ?', id)
}

export async function forgetUploaded(id: string): Promise<void> {
  const db = await getDb()
  await db.runAsync("DELETE FROM scans WHERE id = ? AND status = 'UPLOADED'", id)
}

export async function startupCleanup(): Promise<void> {
  const db = await getDb()
  await db.runAsync("UPDATE scans SET status = 'FAILED', error = 'The upload was interrupted.' WHERE status = 'UPLOADING'")
  const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString()
  await db.runAsync("DELETE FROM scans WHERE status = 'UPLOADED' AND updated_at < ?", cutoff)

  const rows = await listRows()
  const keep = new Set(rows.filter((r) => r.status !== 'UPLOADED').map((r) => r.id))
  const root = pendingRoot()
  for (const entry of root.list()) {
    if (entry instanceof Directory && !keep.has(entry.name)) entry.delete()
  }

  const drafts = draftsRoot()
  if (drafts.exists) drafts.delete()
}
