import type { Quad } from './geometry'
import type { FilterId } from './filters'
import type { Stroke, TextBox } from './marks'
import type { PageSizeId } from './pageSizes'

export type PageParams = {
  sourceUri: string
  width: number
  height: number
  quad: Quad | null
  rotation: 0 | 90 | 180 | 270
  filter: FilterId
  brightness: number
  contrast: number
  pageSize: PageSizeId
  strokes: Stroke[]
  texts: TextBox[]
}

export type Rendered = { base64: string; width: number; height: number }
