import { Feather } from '@expo/vector-icons'
import { router } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useCases, useClients } from '@/api/queries'
import { PickerSheet } from '@/components/Sheet'
import { Banner, Button, Card, Field, Header, Pill, ProgressBar, Row, Screen, SearchBar, Segmented } from '@/components/ui'
import { ALL_CATEGORIES, QUALITY, type QualityId } from '@/constants'
import { buildLocalPdf, previewPdf, sharePdf } from '@/pdf/localPdf'
import { joinPageText, prepareDraft, type PrepareProgress } from '@/pipeline/prepare'
import { startScan } from '@/pipeline/useScanFlow'
import { preparedKey, useDraft } from '@/store/draft'
import { useSettings } from '@/store/settings'
import { colors, fonts, space, type } from '@/theme'
import { enqueue } from '@/upload/pending'
import { useUploadProgress } from '@/upload/progress'
import { runUpload } from '@/upload/run'
import { newId } from '@/utils/format'
import { success, warn } from '@/utils/haptics'
import type { ScrollInstance } from '@/utils/refs'
import type { OcrPayload } from '@/ocr/types'

type SheetName = 'category' | 'client' | 'case' | null

export default function Review() {
  const draft = useDraft()
  const { quality, language, setQuality } = useSettings()
  const [stage, setStage] = useState<PrepareProgress | null>(null)
  const [prepError, setPrepError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetName>(null)
  const [pickSearch, setPickSearch] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [targetError, setTargetError] = useState<string | null>(null)
  const scroller = useRef<ScrollInstance>(null)
  const [queuedId, setQueuedId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)
  const running = useRef(false)

  const clients = useClients(pickSearch, sheet === 'client')
  const cases = useCases(pickSearch, draft.target.clientId, sheet === 'case')
  const fraction = useUploadProgress((s) => (queuedId ? s.byId[queuedId] : undefined))

  const key = preparedKey(draft.pages, quality, language, draft.ocrEnabled)
  const prepared = draft.prepared?.key === key ? draft.prepared : null
  const locked = queuedId !== null

  const prepare = useCallback(async () => {
    if (running.current || draft.pages.length === 0) return
    running.current = true
    setPrepError(null)
    try {
      const result = await prepareDraft(
        draft.sessionId,
        draft.pages,
        { quality, language, runOcr: draft.ocrEnabled },
        setStage,
      )
      useDraft.getState().setPrepared(result)
      useDraft.getState().setText(joinPageText(result.ocr), false)
    } catch (e) {
      setPrepError(e instanceof Error ? e.message : 'The pages could not be processed.')
    } finally {
      running.current = false
      setStage(null)
    }
  }, [draft.pages, draft.sessionId, draft.ocrEnabled, quality, language])

  useEffect(() => {
    if (!prepared && !running.current && !prepError && !done && !locked) void prepare()
  }, [key, prepared, prepare, prepError, done, locked])

  useEffect(() => {
    if (draft.pages.length === 0 && !done) router.back()
  }, [draft.pages.length, done])

  const wordCount = prepared ? prepared.ocr.reduce((n, p) => n + p.words.length, 0) : 0
  const hasText = draft.text.trim().length > 0

  const ocrStatus = (() => {
    if (!draft.ocrEnabled) return { label: 'Text recognition is off', tone: 'mute' as const }
    if (stage?.stage === 'ocr') return { label: `Reading page ${stage.index + 1} of ${stage.total}`, tone: 'info' as const }
    if (stage) return { label: `Preparing page ${stage.index + 1} of ${stage.total}`, tone: 'info' as const }
    if (!prepared) return { label: prepError ? 'Not available' : 'Waiting', tone: prepError ? ('bad' as const) : ('mute' as const) }
    if (!hasText) return { label: 'No text found', tone: 'warn' as const }
    if (prepared.failedPages > 0) return { label: `Text found, ${prepared.failedPages} page(s) unreadable`, tone: 'warn' as const }
    return { label: `${wordCount} words found`, tone: 'ok' as const }
  })()

  const target = draft.target
  const targetLine = [target.clientName, target.caseTitle].filter(Boolean).join('  ·  ')

  const payload = (): OcrPayload | null => {
    if (!prepared || !draft.ocrEnabled || prepared.ocr.length === 0) return null
    return {
      language: prepared.language,
      confidence: null,
      text: draft.text,
      pages: prepared.ocr.map((p) => ({ width: p.width, height: p.height, words: p.words })),
    }
  }

  const submit = async () => {
    setNameError(null)
    setTargetError(null)
    setUploadError(null)
    const noName = draft.name.trim().length === 0
    const noTarget = target.clientId === null && target.caseId === null
    if (noName || noTarget) {
      warn()
      if (noName) setNameError('Enter a document name.')
      if (noTarget) setTargetError('Choose a client or a case so this document is filed correctly.')
      scroller.current?.scrollTo({ y: 0, animated: true })
      return
    }
    if (!prepared) return

    setUploading(true)
    try {
      let id = queuedId
      if (!id) {
        id = newId()
        await enqueue({
          id,
          name: draft.name.trim(),
          category: draft.category,
          clientId: target.clientId,
          clientName: target.clientName,
          caseId: target.caseId,
          caseTitle: target.caseTitle,
          pageUris: prepared.files.map((f) => f.uri),
          ocr: payload(),
          ocrStatus: !hasText ? 'NONE' : prepared.failedPages > 0 ? 'PARTIAL' : 'DONE',
        })
        setQueuedId(id)
      }
      await runUpload(id)
      success()
      setDone(true)
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'The upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const withPdf = async (action: 'preview' | 'share') => {
    if (!prepared) return
    setPdfBusy(true)
    try {
      const file = await buildLocalPdf(prepared.files, draft.name)
      if (action === 'preview') await previewPdf(file)
      else await sharePdf(file, draft.name)
    } catch (e) {
      Alert.alert('PDF failed', e instanceof Error ? e.message : 'Please try again.')
    } finally {
      setPdfBusy(false)
    }
  }

  const leave = () => {
    if (!done && !locked) {
      router.back()
      return
    }
    useDraft.getState().reset()
    router.dismissAll()
  }

  if (done) {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Feather name="check" size={34} color={colors.white} />
          </View>
          <Text style={[type.title, styles.center]} accessibilityRole="header">Uploaded to InterNyay</Text>
          <Text style={[type.body, styles.center]}>
            {`${draft.name} is now in ${targetLine || 'your documents'}. It also appears in the web app.`}
          </Text>
          <View style={styles.doneActions}>
            <Button
              label="Scan another"
              icon="camera"
              onPress={() => {
                const t = useDraft.getState().target
                useDraft.getState().reset()
                router.dismissAll()
                void startScan('camera', t)
              }}
            />
            <Button label="Done" variant="secondary" onPress={leave} />
          </View>
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <Header title="Save to InterNyay" onBack={locked ? undefined : () => router.back()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView ref={scroller} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Field
            label="Document name"
            value={draft.name}
            onChangeText={(v) => {
              draft.setName(v)
              if (nameError) setNameError(null)
            }}
            editable={!locked}
            returnKeyType="done"
            error={nameError}
            hint={`${draft.pages.length} ${draft.pages.length === 1 ? 'page' : 'pages'}`}
          />

          <Text style={[type.heading, styles.sectionTop]}>Where to file it</Text>
          <Card style={[styles.group, targetError ? styles.groupError : null]}>
            <Row icon="tag" title="Category" subtitle={draft.category} onPress={locked ? undefined : () => setSheet('category')} right={<Feather name="chevron-right" size={20} color={colors.inkFaint} />} />
            <Row
              icon="user"
              title="Client"
              subtitle={target.clientName ?? 'Not selected'}
              onPress={locked ? undefined : () => { setPickSearch(''); setSheet('client') }}
              right={<Feather name="chevron-right" size={20} color={colors.inkFaint} />}
            />
            <Row
              icon="briefcase"
              title="Case"
              subtitle={target.caseTitle ?? 'Not selected'}
              onPress={locked ? undefined : () => { setPickSearch(''); setSheet('case') }}
              right={<Feather name="chevron-right" size={20} color={colors.inkFaint} />}
            />
          </Card>
          {targetError ? <Text style={styles.targetError} accessibilityRole="alert">{targetError}</Text> : null}

          <Text style={[type.heading, styles.sectionTop]}>Searchable text</Text>
          <Card style={styles.group}>
            <View style={styles.ocrHead}>
              <View style={styles.flex}>
                <Text style={type.heading}>Text recognition</Text>
                <Text style={type.small}>Makes the PDF searchable. Runs on this device.</Text>
              </View>
              <Switch value={draft.ocrEnabled} onValueChange={draft.setOcrEnabled} disabled={locked} trackColor={{ true: colors.bar }} />
            </View>
            <Pill label={ocrStatus.label} tone={ocrStatus.tone} />
            {stage ? <ProgressBar fraction={(stage.index + (stage.stage === 'ocr' ? 1 : 0.5)) / stage.total} /> : null}
            {prepError ? (
              <View style={styles.gap}>
                <Text style={styles.error}>{prepError}</Text>
                <Button label="Try again" variant="secondary" onPress={() => { setPrepError(null); void prepare() }} />
              </View>
            ) : null}
            {prepared && draft.ocrEnabled && !locked ? (
              <Button label="View and edit text" icon="type" variant="secondary" onPress={() => router.push('/text')} />
            ) : null}
          </Card>

          <Text style={[type.heading, styles.section]}>PDF quality</Text>
          <Segmented<QualityId>
            value={quality}
            onChange={locked ? () => undefined : setQuality}
            options={(Object.keys(QUALITY) as QualityId[]).map((id) => ({ id, label: QUALITY[id].label }))}
          />
          <Text style={[type.small, styles.hint]}>{QUALITY[quality].hint}</Text>

          <View style={styles.pdfActions}>
            <Button label="Preview PDF" icon="eye" variant="secondary" disabled={!prepared} loading={pdfBusy} onPress={() => void withPdf('preview')} style={styles.flex} />
            <Button label="Share or save" icon="share-2" variant="secondary" disabled={!prepared} loading={pdfBusy} onPress={() => void withPdf('share')} style={styles.flex} />
          </View>
          <Text style={[type.small, styles.hint]}>PDFs made on the phone contain page images only. The copy saved in InterNyay is searchable.</Text>
        </ScrollView>

        <View style={styles.footer}>
          {uploadError ? <Banner tone="bad" message={`${uploadError} Your scan is saved in My Scans, so you can retry later.`} /> : null}
          {uploading && fraction !== undefined ? (
            <View style={styles.gap}>
              <ProgressBar fraction={fraction} />
              <Text style={type.caption}>{`Uploading ${Math.round(fraction * 100)}%`}</Text>
            </View>
          ) : null}
          <Button
            label={uploadError ? 'Retry upload' : uploading ? 'Uploading…' : 'Upload to InterNyay'}
            icon="upload-cloud"
            onPress={() => void submit()}
            loading={uploading}
            disabled={!prepared || !!stage}
          />
          {uploadError ? <Button label="Close" variant="ghost" onPress={leave} /> : null}
        </View>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={sheet === 'category'}
        title="Category"
        items={ALL_CATEGORIES}
        keyOf={(c) => c}
        labelOf={(c) => c}
        selectedKey={draft.category}
        onPick={draft.setCategory}
        onClose={() => setSheet(null)}
        empty="No categories."
      />
      <PickerSheet
        visible={sheet === 'client'}
        title="Client"
        items={clients.data?.content ?? []}
        keyOf={(c) => String(c.id)}
        labelOf={(c) => c.name}
        subtitleOf={(c) => c.email ?? undefined}
        selectedKey={target.clientId !== null ? String(target.clientId) : null}
        onPick={(c) => {
          setTargetError(null)
          if (target.caseId !== null && target.clientId !== c.id) draft.setTarget({ clientId: c.id, clientName: c.name, caseId: null, caseTitle: null })
          else draft.setTarget({ clientId: c.id, clientName: c.name })
        }}
        onClose={() => setSheet(null)}
        header={<SearchBar value={pickSearch} onChangeText={setPickSearch} placeholder="Search clients" />}
        empty="No clients found."
        loading={clients.isLoading}
      />
      <PickerSheet
        visible={sheet === 'case'}
        title={target.clientName ? `Cases for ${target.clientName}` : 'Case'}
        items={cases.data?.content ?? []}
        keyOf={(c) => String(c.id)}
        labelOf={(c) => c.title || c.caseNo || `Case ${c.id}`}
        subtitleOf={(c) => [c.caseNo, c.clientName].filter(Boolean).join('  ·  ') || undefined}
        selectedKey={target.caseId !== null ? String(target.caseId) : null}
        onPick={(c) => {
          setTargetError(null)
          draft.setTarget({
            caseId: c.id,
            caseTitle: c.title || c.caseNo || `Case ${c.id}`,
            clientId: c.clientId ?? target.clientId,
            clientName: c.clientName ?? target.clientName,
          })
        }}
        onClose={() => setSheet(null)}
        header={<SearchBar value={pickSearch} onChangeText={setPickSearch} placeholder="Search cases" />}
        empty="No cases found."
        loading={cases.isLoading}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: space.lg, paddingBottom: space.xl },
  group: { gap: space.sm, marginBottom: space.lg, paddingVertical: space.sm },
  ocrHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  gap: { gap: space.sm },
  section: { marginTop: space.sm, marginBottom: space.sm },
  sectionTop: { marginBottom: space.sm },
  groupError: { borderColor: colors.seal, borderWidth: 1.5 },
  targetError: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.seal, marginTop: -space.sm, marginBottom: space.lg },
  hint: { marginTop: space.xs },
  pdfActions: { flexDirection: 'row', gap: space.md, marginTop: space.lg },
  footer: { padding: space.lg, gap: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.surface },
  error: { fontSize: 13, color: colors.seal },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.lg },
  doneIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.ok, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  doneActions: { alignSelf: 'stretch', gap: space.md, marginTop: space.md },
})
