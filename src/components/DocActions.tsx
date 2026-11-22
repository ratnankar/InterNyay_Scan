import { useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import { Alert, StyleSheet, Text, View } from 'react-native'
import { documentsApi } from '@/api/endpoints'
import { downloadDocument } from '@/api/files'
import type { Doc } from '@/api/types'
import { previewPdf, sharePdf } from '@/pdf/localPdf'
import { colors, space, type } from '@/theme'
import { ActionSheet, Sheet, type ActionItem } from './Sheet'
import { Button, Field } from './ui'

export function DocActions({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const client = useQueryClient()
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const scan = doc?.source === 'MOBILE_SCAN'
  const actions: ActionItem[] = [
    { id: 'preview', label: 'Preview PDF', icon: 'eye' },
    { id: 'share', label: 'Share or save PDF', icon: 'share-2' },
    { id: 'text', label: 'View and edit text', icon: 'type', hidden: !scan },
    { id: 'rename', label: 'Rename', icon: 'edit-2' },
    { id: 'delete', label: 'Delete', icon: 'trash-2', danger: true },
  ]

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['scans'] })
    void client.invalidateQueries({ queryKey: ['documents'] })
  }

  const fail = (e: unknown) => Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again.')

  const handle = async (id: string) => {
    if (!doc) return
    try {
      if (id === 'preview') {
        setBusy(true)
        await previewPdf(await downloadDocument(doc))
      } else if (id === 'share') {
        setBusy(true)
        await sharePdf(await downloadDocument(doc), doc.name)
      } else if (id === 'text') {
        router.push({ pathname: '/text', params: { docId: doc.id } })
      } else if (id === 'rename') {
        setName(doc.name)
        setRenaming(true)
      } else if (id === 'delete') {
        Alert.alert('Delete this document?', `"${doc.name}" will be removed from InterNyay, including the case and client records. This cannot be undone.`, [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              try {
                await documentsApi.remove(doc.id)
                refresh()
              } catch (e) {
                fail(e)
              }
            },
          },
        ])
      }
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  const saveName = async () => {
    if (!doc || name.trim().length === 0) return
    setBusy(true)
    try {
      await documentsApi.rename(doc.id, name.trim())
      setRenaming(false)
      refresh()
      onClose()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <ActionSheet visible={doc !== null && !renaming} title={doc?.name ?? ''} actions={actions} onSelect={handle} onClose={onClose} />
      <Sheet visible={renaming} title="Rename document" onClose={() => setRenaming(false)}>
        <Field label="Document name" value={name} onChangeText={setName} autoFocus />
        <View style={styles.row}>
          <Button label="Cancel" variant="secondary" onPress={() => setRenaming(false)} style={styles.flex} />
          <Button label="Save" onPress={saveName} loading={busy} style={styles.flex} />
        </View>
      </Sheet>
      {busy && !renaming ? (
        <View style={styles.busy} pointerEvents="none">
          <Text style={type.small}>Preparing document…</Text>
        </View>
      ) : null}
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1 },
  busy: {
    position: 'absolute',
    bottom: 96,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
  },
})
