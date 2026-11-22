import { useMemo, useState } from 'react'
import { FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useAllDocuments } from '@/api/queries'
import { useNameLookups } from '@/api/lookups'
import type { Doc } from '@/api/types'
import { DocActions } from '@/components/DocActions'
import { DocRow } from '@/components/DocRow'
import { Chip, EmptyState, Screen, SearchBar, SkeletonRows } from '@/components/ui'
import { matchesDoc, searchPlaceholder, type SearchIn } from '@/utils/docSearch'
import { space, type } from '@/theme'

export default function Documents() {
  const documents = useAllDocuments()
  const { describe, clientNames, caseTitles } = useNameLookups()
  const [mode, setMode] = useState<SearchIn>({ client: false, case: false })
  const [search, setSearch] = useState('')
  const [scansOnly, setScansOnly] = useState(false)
  const [selected, setSelected] = useState<Doc | null>(null)

  const items = useMemo(
    () =>
      (documents.data ?? []).filter((d) => {
        if (scansOnly && d.source !== 'MOBILE_SCAN') return false
        return matchesDoc(d, search, mode, { clientNames, caseTitles })
      }),
    [documents.data, search, scansOnly, mode, clientNames, caseTitles],
  )

  const filtering = search.trim().length > 0 || mode.client || mode.case || scansOnly
  const clearFilters = () => {
    setSearch('')
    setMode({ client: false, case: false })
    setScansOnly(false)
  }

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={type.title} accessibilityRole="header">
              Documents
            </Text>
            <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder(mode)} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip icon="user" label="Client" active={mode.client} onPress={() => setMode((m) => ({ ...m, client: !m.client }))} />
              <Chip icon="briefcase" label="Case" active={mode.case} onPress={() => setMode((m) => ({ ...m, case: !m.case }))} />
              <Chip label="Scanned with this app" icon="camera" active={scansOnly} onPress={() => setScansOnly((v) => !v)} />
            </ScrollView>
          </View>
        }
        renderItem={({ item }) => <DocRow doc={item} context={describe(item.clientId, item.caseId)} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          documents.isLoading ? (
            <SkeletonRows count={5} />
          ) : documents.isError ? (
            <EmptyState
              icon="wifi-off"
              title="Could not load documents"
              message={documents.error instanceof Error ? documents.error.message : 'Check your connection, then try again.'}
              action="Try again"
              onAction={() => void documents.refetch()}
            />
          ) : filtering ? (
            <EmptyState icon="search" title="No documents match" message="Try a different word or remove a filter." action="Clear filters" onAction={clearFilters} />
          ) : (
            <EmptyState icon="folder" title="No documents yet" message="Documents in your cases and client folders will appear here." />
          )
        }
        refreshControl={<RefreshControl refreshing={documents.isRefetching} onRefresh={() => void documents.refetch()} />}
        keyboardShouldPersistTaps="handled"
      />
      <DocActions doc={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  header: { gap: space.md, marginBottom: space.md },
  chips: { flexDirection: 'row', gap: space.sm },
})
