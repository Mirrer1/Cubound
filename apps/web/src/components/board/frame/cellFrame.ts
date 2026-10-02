import type { VineLook } from './vineFrame'
import { toScreen } from '@/game/iso'
import type { Point } from '@/game/types'

// x, y는 화면 좌표, p는 칸 좌표, 다시 구멍이 되는 메운 칸은 사라지기 전 높이
// 구덩이로 그리는 칸, 발판 길과 아직 바닥 없는 덩굴 길
export const boardCells = (
  heights: number[][],
  beforeHeights: number[][],
  railDirs: Map<string, string>,
  vines: Map<string, VineLook>,
  fillingKey: string | null,
) =>
  heights
    .flatMap((row, y) =>
      row.map((_, x) => {
        const key = `${x}-${y}`
        const rail = railDirs.get(key) ?? ''
        const now = key === fillingKey ? beforeHeights[y][x] : heights[y][x]
        const pit = rail !== '' || (vines.has(key) && now < 0)
        const h = pit ? 0 : Math.max(now, beforeHeights[y][x])
        return { ...toScreen({ x, y }, h), h, rail, pit, p: { x, y }, key }
      }),
    )
    .filter((cell) => cell.h >= 0)
    .sort((a, b) => a.p.x + a.p.y - (b.p.x + b.p.y))

// 굴러 나가는 큐브가 옆 칸 상자 앞으로 튀어나오지 않게 같은 깊이 맨 앞에 둔 큐브 칸
export const cubeFirst = <T extends { p: Point }>(cells: T[], cube: Point) => {
  const index = cells.findIndex(({ p }) => p.x === cube.x && p.y === cube.y)
  if (index < 0) return cells
  const depth = cube.x + cube.y
  const first = cells.findIndex(({ p }) => p.x + p.y === depth)
  if (first === index) return cells
  const moved = [...cells]
  moved.splice(first, 0, ...moved.splice(index, 1))
  return moved
}
