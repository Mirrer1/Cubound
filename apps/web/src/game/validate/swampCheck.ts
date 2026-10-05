import { type CheckContext, key } from './stageCheck'

export const checkSwamp = ({
  data,
  grid,
  width,
  add,
  isFloor,
  crackCells,
  swampCells,
}: CheckContext) => {
  if (data.swamp !== undefined) {
    const swamp = data.swamp
    const shaped =
      Array.isArray(swamp) &&
      swamp.length === grid.length &&
      swamp.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('swamp는 heights와 같은 모양의 문자열 배열이어야 한다')
    else {
      const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
      const cells = (swamp as string[]).flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
      )

      if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 늪이 있다')
      if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 늪이 있다')
      if (cells.some((cell) => crackCells.has(key(cell)))) add('무너지는 칸에 늪이 있다')

      cells.forEach((cell) => swampCells.add(key(cell)))
      if (isFloor(data.start) && swampCells.has(key(data.start))) add('start가 늪 칸에 있다')
      if (isFloor(data.goal) && swampCells.has(key(data.goal))) add('goal이 늪 칸에 있다')
    }
  }
}
