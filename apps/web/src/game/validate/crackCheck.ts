import { type CheckContext, key } from './stageCheck'

export const checkCracks = ({ data, grid, width, add, isFloor, crackCells }: CheckContext) => {
  if (data.cracks !== undefined) {
    const cracks = data.cracks
    const shaped =
      Array.isArray(cracks) &&
      cracks.length === grid.length &&
      cracks.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('cracks는 heights와 같은 모양의 문자열 배열이어야 한다')
    else {
      const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
      const cells = (cracks as string[]).flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === '.' ? [] : [{ c, x, y }])),
      )

      if (cells.some(({ c }) => c < '1' || c > '9')) add('cracks 값은 점이나 1~9여야 한다')
      if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 무너지는 칸이 있다')
      if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 무너지는 칸이 있다')

      cells.forEach(({ x, y }) => crackCells.add(key({ x, y })))
      if (isFloor(data.goal) && crackCells.has(key(data.goal))) add('goal이 무너지는 칸에 있다')
    }
  }
}
