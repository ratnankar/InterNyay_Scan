import { request } from './http'
import type { CaseItem, Client, Doc, LoginResponse, PageResult, ScanFilters } from './types'

export type AccountType = 'ADVOCATE' | 'ASSOCIATE'

export const authApi = {
  login: (email: string, password: string, accountType: AccountType) =>
    request<LoginResponse>('POST', '/auth/login', { body: { email, password, accountType } }),
  google: (idToken: string, accountType: AccountType) =>
    request<LoginResponse>('POST', '/auth/google/login', { body: { idToken, accountType } }),
}

export const clientsApi = {
  list: (search: string, page = 0, size = 30) =>
    request<PageResult<Client>>('GET', '/clients', { params: { search, page, size } }),
}

export const casesApi = {
  list: (params: { search?: string; clientId?: number | null; page?: number; size?: number }) =>
    request<PageResult<CaseItem>>('GET', '/cases', {
      params: { search: params.search, clientId: params.clientId, page: params.page ?? 0, size: params.size ?? 30 },
    }),
}

// Hearing orders are not shown anywhere in this app
export const isOrder = (d: Doc) => d.miscRole === 'ORDER' || d.orderSeq != null || d.orderDate != null
const withoutOrders = (docs: Doc[]) => docs.filter((d) => !isOrder(d))
const pageWithoutOrders = (page: PageResult<Doc>): PageResult<Doc> => ({ ...page, content: withoutOrders(page.content) })

export const documentsApi = {
  all: () => request<Doc[]>('GET', '/documents').then(withoutOrders),
  forCase: (caseId: number) => request<Doc[]>('GET', '/documents', { params: { caseId } }).then(withoutOrders),
  forClient: (clientId: number) => request<Doc[]>('GET', '/documents', { params: { clientId } }).then(withoutOrders),
  scans: (filters: ScanFilters, page: number, size = 20) =>
    request<PageResult<Doc>>('GET', '/documents/scans', {
      params: {
        q: filters.q,
        clientId: filters.clientId,
        caseId: filters.caseId,
        type: filters.type,
        from: filters.from,
        to: filters.to,
        page,
        size,
      },
    }).then(pageWithoutOrders),
  rename: (id: string, name: string) => request<Doc>('PUT', `/documents/${id}/name`, { body: { name } }),
  remove: (id: string) => request<void>('DELETE', `/documents/${id}`),
  getText: (id: string) => request<{ text: string }>('GET', `/documents/${id}/text`),
  putText: (id: string, text: string) => request<Doc>('PUT', `/documents/${id}/text`, { body: { text } }),
}
