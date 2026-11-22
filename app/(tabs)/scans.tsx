import { Feather } from '@expo/vector-icons'
import { useMemo, useState } from 'react'
import { Alert, FlatList, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useNameLookups } from '@/api/lookups'
import { useAllDocuments } from '@/api/queries'
import type { Doc } from '@/api/types'
import { ALL_CATEGORIES } from '@/constants'
import { DocActions } from '@/components/DocActions'
import { DocRow } from '@/components/DocRow'
import { PickerSheet } from '@/components/Sheet'
import { Banner, Button, Card, Chip, EmptyState, Pill, ProgressBar, Screen, SearchBar, SkeletonRows } from '@/components/ui'
import { colors, space, type } from '@/theme'
import { discardPending, type ScanRow } from '@/upload/pending'
import { useUploadProgress } from '@/upload/progress'
import { runUpload } from '@/upload/run'
import { usePendingRows } from '@/upload/usePending'
import { matchesDoc, searchPlaceholder, type SearchIn } from '@/utils/docSearch'
import { formatDateTime, isoDate } from '@/utils/format'

type Range = 'any' | 'today' | 'week' | 'month'
type Sheetname = 'category' | 'date' | null

const RANGES: { id: Range; label: string }[] = [
  { id: 'any', label: 'Any time' },
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'Last 7 days' },
  { id: 'month', label: 'Last 30 days' },
]

function rangeDates(range: Range): { from: string | null; to: string | null } {
  if (range === 'any') return { from: null, to: null }
  const now = new Date()
  const start = new Date(now)
  if (range === 'week') start.setDate(start.getDate() - 6)
  if (range === 'month') start.setDate(start.getDate() - 29)
  return { from: isoDate(start), to: isoDate(now) }
}

export default function MyScans() {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<SearchIn>({ client: false, case: false })
  const [category, setCategory] = useState<string | null>(null)
  const [range, setRange] = useState<Range>('any')
  const [sheet, setSheet] = useState<Sheetname>(null)
  const [selected, setSelected] = useState<Doc | null>(null)

  const dates = rangeDates(range)
  const documents = useAllDocuments()
  const { rows, waiting, refetch: refetchPending } = usePendingRows()
  const { describe, clientNames, caseTitles } = useNameLookups()
  const progress = useUploadProgress((s) => s.byId)

  const items = useMemo(
    () =>
      (documents.data ?? []).filter((d) => {
        if (d.source !== 'MOBILE_SCAN') return false
        if (category !== null && d.type !== category) return false
        if (dates.from && (!d.date || d.date < dates.from)) return false
        if (dates.to && (!d.date || d.date > dates.to)) return false
        return matchesDoc(d, search, mode, { clientNames, caseTitles })
      }),
    [documents.data, search, mode, category, dates.from, dates.to, clientNames, caseTitles],
  )

  const retry = async (row: ScanRow) => {
    try {
      await runUpload(row.id)
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Please try again.')
    }
    refetchPending()
  }

  const discard = (row: ScanRow) =>
    Alert.alert('Delete this scan?', 'It has not been uploaded. The pages will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await discardPending(row.id)
          refetchPending()
        },
      },
    ])

  const dateLabel = RANGES.find((r) => r.id === range)?.label ?? 'Any time'
  const filtering = search.trim().length > 0 || mode.client || mode.case || category !== null || range !== 'any'
  const clearFilters = () => {
    setSearch('')
    setMode({ client: false, case: false })
    setCategory(null)
    setRange('any')
  }

  const header = (
    <View>
      <Text style={[type.title, styles.title]} accessibilityRole="header">
        My Scans
      </Text>
      <SearchBar value={search} onChangeText={setSearch} placeholder={searchPlaceholder(mode)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip icon="user" label="Client" active={mode.client} onPress={() => setMode((m) => ({ ...m, client: !m.client }))} />
        <Chip icon="briefcase" label="Case" active={mode.case} onPress={() => setMode((m) => ({ ...m, case: !m.case }))} />
        <Chip icon="tag" label={category ?? 'Category'} active={category !== null} onPress={() => setSheet('category')} onClear={() => setCategory(null)} />
        <Chip icon="calendar" label={dateLabel} active={range !== 'any'} onPress={() => setSheet('date')} onClear={() => setRange('any')} />
      </ScrollView>

      {waiting.length > 0 ? (
        <View style={styles.pending}>
          <Text style={type.heading}>{`Waiting to upload (${waiting.length})`}</Text>
          {waiting.map((row) => {
            const fraction = progress[row.id]
            const uploading = row.status === 'UPLOADING' && fraction !== undefined
            return (
              <Card key={row.id} style={styles.pendingCard}>
                <View style={styles.pendingTop}>
                  <View style={styles.flex}>
                    <Text style={type.body} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={type.small} numberOfLines={1}>
                      {[row.clientName, row.caseTitle].filter(Boolean).join('  ·  ') || row.category}
                    </Text>
                    <Text style={type.small}>{`${row.pageCount} pg  ·  ${formatDateTime(row.createdAt)}`}</Text>
                  </View>
                  <Pill label={uploading ? 'Uploading' : row.status === 'FAILED' ? 'Failed' : 'Queued'} tone={row.status === 'FAILED' ? 'bad' : 'info'} />
                </View>
                {uploading ? <ProgressBar fraction={fraction} /> : null}
                {uploading ? <Text style={type.caption}>{`${Math.round((fraction ?? 0) * 100)}% uploaded`}</Text> : null}
                {row.error && row.status === 'FAILED' ? <Banner tone="bad" message={`${row.error} Your pages are safe on this device.`} /> : null}
                {row.status === 'FAILED' ? (
                  <View style={styles.pendingActions}>
                    <Button label="Delete" variant="ghost" onPress={() => discard(row)} />
                    <Button label="Retry upload" icon="refresh-cw" onPress={() => void retry(row)} style={styles.flex} />
                  </View>
                ) : null}
              </Card>
            )
          })}
        </View>
      ) : null}

      {items.length > 0 ? (
        <Text style={[type.heading, styles.listTitle]}>
          {filtering ? `${items.length} ${items.length === 1 ? 'result' : 'results'}` : 'Uploaded scans'}
        </Text>
      ) : null}
    </View>
  )

  return (
    <Screen>
      <FlatList
        data={items}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={header}
        renderItem={({ item }) => <DocRow doc={item} context={describe(item.clientId, item.caseId)} onPress={() => setSelected(item)} />}
        ListEmptyComponent={
          documents.isLoading ? (
            <SkeletonRows count={4} />
          ) : documents.isError ? (
            <EmptyState
              icon="wifi-off"
              title="Could not load scans"
              message={documents.error instanceof Error ? documents.error.message : 'Check your connection, then try again.'}
              action="Try again"
              onAction={() => void documents.refetch()}
            />
          ) : filtering ? (
            <EmptyState icon="search" title="No scans match" message="Try a different word or remove a filter." action="Clear filters" onAction={clearFilters} />
          ) : (
            <EmptyState icon="layers" title="No uploaded scans yet" message="Scans you upload from this app will appear here." />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={documents.isRefetching}
            onRefresh={() => {
              void documents.refetch()
              refetchPending()
            }}
          />
        }
        keyboardShouldPersistTaps="handled"
      />

      <PickerSheet
        visible={sheet === 'category'}
        title="Filter by category"
        items={ALL_CATEGORIES}
        keyOf={(c) => c}
        labelOf={(c) => c}
        selectedKey={category}
        onPick={setCategory}
        onClose={() => setSheet(null)}
        empty="No categories."
      />
      <PickerSheet
        visible={sheet === 'date'}
        title="Filter by date"
        items={RANGES}
        keyOf={(r) => r.id}
        labelOf={(r) => r.label}
        selectedKey={range}
        onPick={(r) => setRange(r.id)}
        onClose={() => setSheet(null)}
        empty="No options."
      />
      <DocActions doc={selected} onClose={() => setSelected(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl * 2 },
  title: { marginBottom: space.md },
  chips: { gap: space.sm, paddingVertical: space.md },
  pending: { gap: space.sm, marginBottom: space.md },
  pendingCard: { gap: space.md, padding: space.md },
  pendingTop: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  pendingActions: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  error: { fontSize: 13, color: colors.seal },
  listTitle: { marginTop: space.sm, marginBottom: space.sm },
  centered: { textAlign: 'center', paddingVertical: space.xl },
})
