import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { casesApi, clientsApi, documentsApi } from './endpoints'
import type { ScanFilters } from './types'

export function useClients(search: string, enabled = true) {
  return useQuery({
    queryKey: ['clients', search],
    queryFn: () => clientsApi.list(search),
    enabled,
    staleTime: 60_000,
  })
}

export function useCases(search: string, clientId: number | null, enabled = true) {
  return useQuery({
    queryKey: ['cases', search, clientId],
    queryFn: () => casesApi.list({ search, clientId }),
    enabled,
    staleTime: 60_000,
  })
}

export function useAllDocuments() {
  return useQuery({ queryKey: ['documents', 'all'], queryFn: documentsApi.all, staleTime: 30_000 })
}

export function useFolderDocuments(kind: 'case' | 'client', id: number) {
  return useQuery({
    queryKey: ['documents', kind, id],
    queryFn: () => (kind === 'case' ? documentsApi.forCase(id) : documentsApi.forClient(id)),
  })
}

export function useScans(filters: ScanFilters) {
  return useInfiniteQuery({
    queryKey: ['scans', filters],
    queryFn: ({ pageParam }) => documentsApi.scans(filters, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.last ? undefined : last.number + 1),
  })
}

export function useRecentScans() {
  return useQuery({
    queryKey: ['scans', 'recent'],
    queryFn: () => documentsApi.scans({}, 0, 5),
    staleTime: 15_000,
  })
}
