import { File } from 'expo-file-system'
import { QUALITY, type QualityId } from '@/constants'
import { renderToFile } from '@/imaging/render'
import { languageLabel, recognizeImage } from '@/ocr/recognize'
import type { OcrLanguage, OcrPage } from '@/ocr/types'
import { draftDir } from './importPages'
import type { EditPage } from './types'
import type { Prepared } from '@/store/draft'
import { preparedKey } from '@/store/draft'

export type PrepareProgress = { stage: 'render' | 'ocr'; index: number; total: number }

export async function prepareDraft(
  sessionId: string,
  pages: EditPage[],
  options: { quality: QualityId; language: OcrLanguage; runOcr: boolean },
  onProgress: (p: PrepareProgress) => void,
): Promise<Prepared> {
  const preset = QUALITY[options.quality]
  const dir = draftDir(sessionId)
  const files: Prepared['files'] = []
  const ocr: OcrPage[] = []
  let failed = 0

  for (let i = 0; i < pages.length; i++) {
    onProgress({ stage: 'render', index: i, total: pages.length })
    const page = pages[i]
    const out = await renderToFile(page, preset.maxEdge, preset.jpeg, new File(dir, `page-${i + 1}-${page.rev}.jpg`))
    files.push(out)

    if (options.runOcr) {
      onProgress({ stage: 'ocr', index: i, total: pages.length })
      try {
        ocr.push(await recognizeImage(out.uri, out.width, out.height, options.language))
      } catch {
        failed++
        ocr.push({ width: out.width, height: out.height, words: [], text: '' })
      }
    }
  }

  return {
    key: preparedKey(pages, options.quality, options.language, options.runOcr),
    files,
    ocr,
    language: options.runOcr ? languageLabel(ocr, options.language) : 'none',
    failedPages: failed,
  }
}

export function joinPageText(ocr: OcrPage[]): string {
  return ocr
    .map((p) => p.text.trim())
    .filter((t) => t.length > 0)
    .join('\n\n')
}
