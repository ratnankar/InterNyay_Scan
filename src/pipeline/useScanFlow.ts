import { router } from 'expo-router'
import { Alert } from 'react-native'
import { MAX_PAGES } from '@/constants'
import { useDraft, type Target } from '@/store/draft'
import { importFromGallery, importFromPdf, scanWithCamera } from './importPages'
import type { EditPage } from './types'

type Source = 'camera' | 'gallery' | 'pdf'

export async function collectPages(source: Source): Promise<EditPage[]> {
  const { sessionId, pages } = useDraft.getState()
  const room = MAX_PAGES - pages.length
  if (room <= 0) {
    Alert.alert('Page limit reached', `A scan can have up to ${MAX_PAGES} pages.`)
    return []
  }
  try {
    if (source === 'camera') return await scanWithCamera(sessionId, room)
    if (source === 'gallery') return await importFromGallery(sessionId, room)
    return await importFromPdf(sessionId, room)
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    Alert.alert('Could not add pages', message.length > 0 ? message : 'Please try again.')
    return []
  }
}

export async function startScan(source: Source = 'camera', target?: Partial<Target>) {
  const draft = useDraft.getState()
  if (draft.pages.length === 0 && target) draft.setTarget(target)
  const pages = await collectPages(source)
  if (pages.length === 0) return
  useDraft.getState().addPages(pages)
  router.push('/edit')
}
