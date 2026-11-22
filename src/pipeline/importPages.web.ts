import type { Directory } from 'expo-file-system'
import type { EditPage } from './types'

const UNSUPPORTED = 'Scanning and importing pages is not available in the web build yet. Use the Android or iOS app.'

export function draftsRoot(): Directory {
  throw new Error(UNSUPPORTED)
}
export function draftDir(_sessionId: string): Directory {
  throw new Error(UNSUPPORTED)
}
export async function scanWithCamera(_s: string, _max: number): Promise<EditPage[]> {
  throw new Error(UNSUPPORTED)
}
export async function importFromGallery(_s: string, _max: number): Promise<EditPage[]> {
  throw new Error(UNSUPPORTED)
}
export async function importFromPdf(_s: string, _max: number): Promise<EditPage[]> {
  throw new Error(UNSUPPORTED)
}
export function deleteDraftDir(_sessionId: string) {}
export function clearAllDrafts() {}
