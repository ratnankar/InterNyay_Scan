import type { Doc } from '@/api/types'

export type SearchIn = { client: boolean; case: boolean }

type Names = { clientNames: Map<number, string>; caseTitles: Map<number, string> }

export function searchPlaceholder(m: SearchIn): string {
  if (m.client && m.case) return 'Type a client name or case title'
  if (m.client) return 'Type a client name'
  if (m.case) return 'Type a case title or number'
  return 'Search by document, client or case'
}

// No chip on: match document name, type, client and case. Client and/or Case chip on: match only those fields.
export function matchesDoc(d: Doc, rawNeedle: string, mode: SearchIn, names: Names): boolean {
  const needle = rawNeedle.trim().toLowerCase()
  if (!needle) return true
  const client = (d.clientId != null ? names.clientNames.get(d.clientId) : '')?.toLowerCase() ?? ''
  const caseTitle = (d.caseId != null ? names.caseTitles.get(d.caseId) : '')?.toLowerCase() ?? ''
  if (mode.client || mode.case) {
    return (mode.client && client.includes(needle)) || (mode.case && caseTitle.includes(needle))
  }
  return d.name.toLowerCase().includes(needle) || (d.type ?? '').toLowerCase().includes(needle) || client.includes(needle) || caseTitle.includes(needle)
}

// Newest upload first. Falls back to the document date when there is no upload time.
export function byNewest(a: Doc, b: Doc): number {
  return (b.uploadedAt ?? b.date ?? '').localeCompare(a.uploadedAt ?? a.date ?? '')
}
