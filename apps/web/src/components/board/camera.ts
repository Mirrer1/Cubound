import { TILE, toScreen } from '@/game/iso'
import type { Zone } from '@/game/types'

const MARGIN = 40

export type ViewBox = [number, number, number, number]

// 구역 칸들이 들어오는 viewBox, 구역이 없으면 맵 전체
export const viewBoxFor = (heights: number[][], zone?: Zone): ViewBox => {
  const cells = heights
    .flatMap((row, y) => row.map((h, x) => ({ x, y, h })))
    .filter(
      ({ x, y, h }) =>
        h >= 0 &&
        (!zone || (x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h)),
    )
    .map(({ x, y, h }) => ({ h, ...toScreen({ x, y }, h) }))

  const minX = Math.min(...cells.map((c) => c.x - TILE.width / 2)) - MARGIN
  const maxX = Math.max(...cells.map((c) => c.x + TILE.width / 2)) + MARGIN
  const minY = Math.min(...cells.map((c) => c.y - TILE.height / 2 - TILE.layer * 2)) - MARGIN
  const maxY =
    Math.max(...cells.map((c) => c.y + TILE.height / 2 + c.h * TILE.layer + TILE.lip)) + MARGIN

  return [minX, minY, maxX - minX, maxY - minY]
}
