import type { Quad } from './geometry'
import type { TextBox } from './marks'
import type { PageParams, Rendered } from './types'

export type { PageParams, Rendered } from './types'

const UNSUPPORTED = 'Image editing is not available in the web build yet.'

export async function loadImage(_uri: string): Promise<never> {
  throw new Error(UNSUPPORTED)
}
export function forgetImage(_uri: string) {}
export function clearImageCache() {}
export function measureText(box: TextBox, contentW: number, _contentH: number): { width: number; height: number } {
  return { width: box.w * Math.min(contentW, _contentH), height: box.size * Math.min(contentW, _contentH) * 1.3 }
}
export async function renderPage(_p: PageParams, _maxEdge: number, _q: number): Promise<Rendered> {
  throw new Error(UNSUPPORTED)
}
export async function renderToFile(..._args: unknown[]): Promise<{ uri: string; width: number; height: number }> {
  throw new Error(UNSUPPORTED)
}
export async function detectQuad(_uri: string): Promise<Quad | null> {
  return null
}
