import { type CheckContext, key } from './stageCheck'

export const checkMushroom = ({
  data,
  grid,
  width,
  add,
  isFloor,
  crackCells,
  swampCells,
  mushroomCells,
}: CheckContext) => {
  if (data.mushroom !== undefined) {
    const mushroom = data.mushroom
    const shaped =
      Array.isArray(mushroom) &&
      mushroom.length === grid.length &&
      mushroom.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('mushroom은 heights와 같은 모양의 문자열 배열이어야 한다')
    else {
      const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
      const cells = (mushroom as string[]).flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
      )

      if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 버섯이 있다')
      if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 버섯이 있다')
      if (cells.some((cell) => crackCells.has(key(cell)))) add('무너지는 칸에 버섯이 있다')
      if (cells.some((cell) => swampCells.has(key(cell)))) add('늪 칸에 버섯이 있다')

      cells.forEach((cell) => mushroomCells.add(key(cell)))
      if (isFloor(data.start) && mushroomCells.has(key(data.start))) add('start가 버섯 칸에 있다')
      if (isFloor(data.goal) && mushroomCells.has(key(data.goal))) add('goal이 버섯 칸에 있다')
    }
  }
}
