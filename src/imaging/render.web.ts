import type { Quad } from './geometry'
import type { FilterId } from './filters'

export type PageParams = {
  sourceUri: string
  width: number
  height: number
  quad: Quad | null
  rotation: 0 | 90 | 180 | 270
  filter: FilterId
  brightness: number
  contrast: number
}

export type Rendered = { base64: string; width: number; height: number }

const UNSUPPORTED = 'Image editing is not available in the web build yet.'

export async function loadImage(_uri: string): Promise<never> {
  throw new Error(UNSUPPORTED)
}
export function forgetImage(_uri: string) {}
export function clearImageCache() {}
export async function renderPage(_p: PageParams, _maxEdge: number, _q: number): Promise<Rendered> {
  throw new Error(UNSUPPORTED)
}
export async function renderToFile(..._args: unknown[]): Promise<{ uri: string; width: number; height: number }> {
  throw new Error(UNSUPPORTED)
}
export async function detectQuad(_uri: string): Promise<Quad | null> {
  return null
}
