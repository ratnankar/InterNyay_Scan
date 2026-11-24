import type { Quad } from '@/imaging/geometry'
import type { FilterId } from '@/imaging/filters'
import type { Stroke, TextBox } from '@/imaging/marks'
import type { PageSizeId } from '@/imaging/pageSizes'

export type EditPage = {
  id: string
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
  rev: number
}
