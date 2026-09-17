import type { Point } from './types'

// 서 있는 높이 standHeight의 한 층짜리 물체를 화면에서 가리는 앞쪽 칸들
export const occludingCells = (heights: number[][], target: Point, standHeight: number) => {
  const cells: Point[] = []

  for (let dy = 0; dy <= 2; dy++) {
    for (let dx = 0; dx <= 2; dx++) {
      if (dx + dy === 0 || Math.abs(dx - dy) > 1) continue

      const x = target.x + dx
      const y = target.y + dy
      const h = heights[y]?.[x]
      if (h !== undefined && h >= standHeight + dx + dy) cells.push({ x, y })
    }
  }

  return cells
}
