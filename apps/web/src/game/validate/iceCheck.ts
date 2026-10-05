import type { CheckContext } from './stageCheck'

export const checkIce = ({ data, grid, width, add }: CheckContext) => {
  if (data.ice !== undefined) {
    const ice = data.ice
    const shaped =
      Array.isArray(ice) &&
      ice.length === grid.length &&
      ice.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('ice는 heights와 같은 모양의 문자열 배열이어야 한다')
    else if (
      (ice as string[]).some((row, y) => [...row].some((c, x) => c === '#' && grid[y][x] < 0))
    )
      add('바닥 없는 칸에 얼음이 있다')
  }
}
