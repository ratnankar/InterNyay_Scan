import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { documentsApi } from '@/api/endpoints'
import { Banner, Button, Field, Header, Screen, SkeletonRows } from '@/components/ui'
import { joinPageText } from '@/pipeline/prepare'
import { useDraft } from '@/store/draft'
import { space, type } from '@/theme'
import { success } from '@/utils/haptics'

export default function TextScreen() {
  const { docId } = useLocalSearchParams<{ docId?: string }>()
  const client = useQueryClient()
  const draftText = useDraft((s) => s.text)
  const prepared = useDraft((s) => s.prepared)
  const setDraftText = useDraft((s) => s.setText)

  const remote = useQuery({
    queryKey: ['docText', docId],
    queryFn: () => documentsApi.getText(docId as string),
    enabled: !!docId,
  })

  const [value, setValue] = useState(docId ? '' : draftText)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const original = docId ? (remote.data?.text ?? '') : draftText
  const dirty = value !== original

  useEffect(() => {
    if (docId && remote.data) setValue(remote.data.text)
  }, [docId, remote.data])

  const copy = async () => {
    await Clipboard.setStringAsync(value)
    success()
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  const back = () => {
    if (!dirty) {
      router.back()
      return
    }
    Alert.alert('Discard your edits?', 'Changes to the text have not been saved.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => router.back() },
    ])
  }

  const save = async () => {
    if (!docId) {
      setDraftText(value, true)
      router.back()
      return
    }
    setSaving(true)
    try {
      await documentsApi.putText(docId, value)
      void client.invalidateQueries({ queryKey: ['docText', docId] })
      void client.invalidateQueries({ queryKey: ['scans'] })
      void client.invalidateQueries({ queryKey: ['documents'] })
      router.back()
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const restore = () => {
    if (prepared) setValue(joinPageText(prepared.ocr))
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Extracted text" onBack={back} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {docId && remote.isLoading ? <SkeletonRows count={2} /> : null}
          {docId && remote.isError ? <Banner tone="bad" message="The text could not be loaded." action="Try again" onAction={() => void remote.refetch()} /> : null}
          <Field
            label="Text"
            value={value}
            onChangeText={setValue}
            multiline
            autoCorrect={false}
            editable={!(docId && remote.isLoading)}
            hint="Fix any words the scanner misread. Search uses this text."
          />
          <Text style={type.small}>{`${value.trim().length === 0 ? 0 : value.trim().split(/\s+/).length} words`}</Text>
        </ScrollView>
        <View style={styles.actions}>
          <Button label={copied ? 'Copied' : 'Copy'} icon={copied ? 'check' : 'copy'} variant="secondary" onPress={() => void copy()} style={styles.flex} />
          {!docId && prepared ? <Button label="Reset" variant="secondary" onPress={restore} style={styles.flex} /> : null}
          <Button label="Save text" onPress={() => void save()} loading={saving} disabled={!dirty} style={styles.flex} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg },
  actions: { flexDirection: 'row', gap: space.md, padding: space.lg },
})
