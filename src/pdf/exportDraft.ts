import { File } from 'expo-file-system'
import { QUALITY, type QualityId } from '@/constants'
import { renderToFile } from '@/imaging/render'
import { draftDir } from '@/pipeline/importPages'
import type { EditPage } from '@/pipeline/types'
import { buildLocalPdf } from './localPdf'

// Renders every page with all edits applied and bundles them into a PDF in the cache folder.
export async function exportDraftPdf(sessionId: string, pages: EditPage[], name: string, quality: QualityId): Promise<File> {
  const preset = QUALITY[quality]
  const dir = draftDir(sessionId)
  const files: { uri: string; width: number; height: number }[] = []
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    files.push(await renderToFile(page, preset.maxEdge, preset.jpeg, new File(dir, `export-${i + 1}-${page.rev}.jpg`)))
  }
  return buildLocalPdf(files, name)
}
