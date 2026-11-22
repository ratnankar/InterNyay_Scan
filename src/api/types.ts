export type User = {
  id: number
  name: string
  email: string
  role?: string
  advocateName?: string | null
  planCode?: string | null
}

export type LoginResponse = { token: string; user: User }

export type Doc = {
  id: string
  caseId?: number | null
  clientId?: number | null
  name: string
  type?: string | null
  fileName?: string | null
  size: string
  sizeBytes: number
  mimeType?: string | null
  date?: string | null
  source?: string | null
  pageCount?: number | null
  ocrStatus?: string | null
  ocrLanguage?: string | null
  ocrConfidence?: number | null
  uploadedAt?: string | null
  miscRole?: string | null
  orderSeq?: number | null
  orderDate?: string | null
}

export type Client = { id: number; name: string; email?: string | null; type?: string | null }

export type CaseItem = {
  id: number
  title?: string | null
  caseNo?: string | null
  court?: string | null
  clientId?: number | null
  clientName?: string | null
  status?: string | null
}

export type PageResult<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  last: boolean
}

export type ScanFilters = {
  q?: string
  clientId?: number | null
  caseId?: number | null
  type?: string | null
  from?: string | null
  to?: string | null
}
