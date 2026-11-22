import { useQuery } from '@tanstack/react-query'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { listRows, type ScanRow } from './pending'

export function usePendingRows(): { rows: ScanRow[]; waiting: ScanRow[]; refetch: () => void } {
  const query = useQuery({ queryKey: ['pending'], queryFn: listRows, staleTime: 0 })
  const refetch = query.refetch
  useFocusEffect(
    useCallback(() => {
      void refetch()
    }, [refetch]),
  )
  const rows = query.data ?? []
  return { rows, waiting: rows.filter((r) => r.status !== 'UPLOADED'), refetch: () => void refetch() }
}
