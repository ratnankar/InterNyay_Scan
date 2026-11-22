import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { casesApi, clientsApi } from './endpoints'

export function useNameLookups() {
  const clients = useQuery({ queryKey: ['lookup', 'clients'], queryFn: () => clientsApi.list('', 0, 200), staleTime: 5 * 60_000 })
  const cases = useQuery({ queryKey: ['lookup', 'cases'], queryFn: () => casesApi.list({ size: 200 }), staleTime: 5 * 60_000 })

  return useMemo(() => {
    const clientNames = new Map<number, string>()
    clients.data?.content.forEach((c) => clientNames.set(c.id, c.name))
    const caseTitles = new Map<number, string>()
    cases.data?.content.forEach((c) => caseTitles.set(c.id, c.title || c.caseNo || `Case ${c.id}`))
    const describe = (clientId?: number | null, caseId?: number | null): string => {
      const parts: string[] = []
      if (clientId != null && clientNames.has(clientId)) parts.push(clientNames.get(clientId) as string)
      if (caseId != null && caseTitles.has(caseId)) parts.push(caseTitles.get(caseId) as string)
      return parts.join('  ·  ')
    }
    return { describe, clientNames, caseTitles }
  }, [clients.data, cases.data])
}
