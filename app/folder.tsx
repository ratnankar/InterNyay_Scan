import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { FlatList, StyleSheet, View } from 'react-native'
import { useFolderDocuments } from '@/api/queries'
import type { Doc } from '@/api/types'
import { DocActions } from '@/components/DocActions'
import { DocRow } from '@/components/DocRow'
import { Button, EmptyState, Header, Screen, SkeletonRows } from '@/components/ui'
import { startScan } from '@/pipeline/useScanFlow'
import { space } from '@/theme'

export default function Folder() {
  const params = useLocalSearchParams<{ kind: string; id: string; title: string; clientId?: string }>()
  const kind = params.kind === 'case' ? 'case' : 'client'
  const id = Number(params.id)
  const title = params.title ?? ''
  const clientId = params.clientId ? Number(params.clientId) : null
  const docs = useFolderDocuments(kind, id)
  const [selected, setSelected] = useState<Doc | null>(null)

  const scanHere = () => {
    if (kind === 'case') void startScan('camera', { caseId: id, caseTitle: title, clientId })
    else void startScan('camera', { clientId: id, clientName: title })
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title={title} onBack={() => router.back()} />
      <FlatList
        data={docs.data ?? []}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        renderItem={({ item }) => <DocRow doc={item} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          docs.isLoading ? (
            <SkeletonRows count={4} />
          ) : docs.isError ? (
            <EmptyState icon="wifi-off" title="Could not load documents" message="Check your connection, then try again." action="Try again" onAction={() => void docs.refetch()} />
          ) : (
            <EmptyState icon="folder" title="No documents yet" message={`Scan a document into this ${kind} to see it here.`} />
          )
        }
      />
      <View style={styles.footer}>
        <Button label={`Scan into this ${kind}`} icon="camera" onPress={scanHere} />
      </View>
      <DocActions doc={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  footer: { padding: space.lg },
})
