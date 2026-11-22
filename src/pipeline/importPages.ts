import { Directory, File, Paths } from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import DocumentScanner, { ResponseType, ScanDocumentResponseStatus } from 'react-native-document-scanner-plugin'
import PdfThumbnail from 'react-native-pdf-thumbnail'
import { WORKING_EDGE } from '@/constants'
import { detectQuad, forgetImage } from '@/imaging/render'
import { newId, toFileUri } from '@/utils/format'
import type { EditPage } from './types'

export function draftsRoot(): Directory {
  const dir = new Directory(Paths.cache, 'drafts')
  if (!dir.exists) dir.create({ intermediates: true })
  return dir
}

export function draftDir(sessionId: string): Directory {
  const dir = new Directory(draftsRoot(), sessionId)
  if (!dir.exists) dir.create({ intermediates: true })
  return dir
}

async function normalize(uri: string, sessionId: string, autoCrop: boolean): Promise<EditPage> {
  const first = await ImageManipulator.manipulateAsync(toFileUri(uri), [], { compress: 1, format: ImageManipulator.SaveFormat.JPEG })
  const longest = Math.max(first.width, first.height)
  let result = first
  if (longest > WORKING_EDGE) {
    const resize = first.width >= first.height ? { width: WORKING_EDGE } : { height: WORKING_EDGE }
    result = await ImageManipulator.manipulateAsync(first.uri, [{ resize }], {
      compress: 0.92,
      format: ImageManipulator.SaveFormat.JPEG,
    })
  }

  const id = newId()
  const target = new File(draftDir(sessionId), `src-${id}.jpg`)
  await new File(result.uri).copy(target)
  if (result.uri !== first.uri) {
    const extra = new File(first.uri)
    if (extra.exists) extra.delete()
  }
  const temp = new File(result.uri)
  if (temp.exists) temp.delete()

  let quad = null
  if (autoCrop) {
    try {
      quad = await detectQuad(target.uri)
    } catch {
      quad = null
    }
    forgetImage(target.uri)
  }

  return {
    id,
    sourceUri: target.uri,
    width: result.width,
    height: result.height,
    quad,
    rotation: 0,
    filter: 'auto',
    brightness: 0,
    contrast: 0,
    rev: 0,
  }
}

function removeScannerTemp(uri: string) {
  try {
    const f = new File(toFileUri(uri))
    if (f.exists) f.delete()
  } catch {
    return
  }
}

export async function scanWithCamera(sessionId: string, max: number): Promise<EditPage[]> {
  if (max <= 0) return []
  const response = await DocumentScanner.scanDocument({
    maxNumDocuments: max,
    croppedImageQuality: 100,
    responseType: ResponseType.ImageFilePath,
  })
  if (response.status !== ScanDocumentResponseStatus.Success || !response.scannedImages) return []
  const pages: EditPage[] = []
  for (const uri of response.scannedImages) {
    pages.push(await normalize(uri, sessionId, false))
    removeScannerTemp(uri)
  }
  return pages
}

export async function importFromGallery(sessionId: string, max: number): Promise<EditPage[]> {
  if (max <= 0) return []
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: max,
    quality: 1,
    exif: false,
  })
  if (result.canceled) return []
  const pages: EditPage[] = []
  for (const asset of result.assets) {
    pages.push(await normalize(asset.uri, sessionId, true))
  }
  return pages
}

export async function importFromPdf(sessionId: string, max: number): Promise<EditPage[]> {
  if (max <= 0) return []
  const picked = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  })
  if (picked.canceled || picked.assets.length === 0) return []
  const asset = picked.assets[0]
  const thumbs = await PdfThumbnail.generateAllPages(asset.uri, { quality: 95 })
  const pages: EditPage[] = []
  for (const thumb of thumbs.slice(0, max)) {
    pages.push(await normalize(thumb.uri, sessionId, false))
    removeScannerTemp(thumb.uri)
  }
  removeScannerTemp(asset.uri)
  return pages
}

export function deleteDraftDir(sessionId: string) {
  const dir = new Directory(draftsRoot(), sessionId)
  if (dir.exists) dir.delete()
}

export function clearAllDrafts() {
  const dir = new Directory(Paths.cache, 'drafts')
  if (dir.exists) dir.delete()
}
