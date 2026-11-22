import { Directory, File, Paths } from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { safeFileName } from '@/utils/format'

type PageFile = { uri: string; width: number; height: number }

const PAGE_WIDTH = 595

export async function buildLocalPdf(pages: PageFile[], name: string): Promise<File> {
  if (pages.length === 0) throw new Error('There are no pages to export.')
  const first = pages[0]
  const height = Math.round((PAGE_WIDTH * first.height) / first.width)

  const images: string[] = []
  for (const page of pages) {
    const base64 = await new File(page.uri).base64()
    images.push(`<div class="page"><img src="data:image/jpeg;base64,${base64}"/></div>`)
  }

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
@page { size: ${PAGE_WIDTH}pt ${height}pt; margin: 0; }
html, body { margin: 0; padding: 0; }
.page { width: ${PAGE_WIDTH}pt; height: ${height}pt; page-break-after: always; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.page:last-child { page-break-after: auto; }
img { max-width: 100%; max-height: 100%; }
</style></head><body>${images.join('')}</body></html>`

  const printed = await Print.printToFileAsync({ html, width: PAGE_WIDTH, height })
  const dir = new Directory(Paths.cache, 'exports')
  if (!dir.exists) dir.create({ intermediates: true })
  const base = safeFileName(name)
  const target = new File(dir, base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`)
  if (target.exists) target.delete()
  const temp = new File(printed.uri)
  await temp.copy(target)
  if (temp.exists) temp.delete()
  return target
}

export async function sharePdf(file: File, title: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.')
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: title })
}

export async function previewPdf(file: File): Promise<void> {
  if (await File.canPreview(file)) {
    await file.preview()
    return
  }
  await sharePdf(file, file.name)
}

export function clearExports() {
  const dir = new Directory(Paths.cache, 'exports')
  if (dir.exists) dir.delete()
}
