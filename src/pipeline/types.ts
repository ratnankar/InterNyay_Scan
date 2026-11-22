import type { Quad } from '@/imaging/geometry'
import type { FilterId } from '@/imaging/filters'

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
  rev: number
}
