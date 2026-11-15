import type { CheckContext } from './stageCheck'

const SIDES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

export const checkShadow = ({ data, grid, width, add }: CheckContext) => {
  if (data.shadow === undefined) return

  const shadow = data.shadow
  const shaped =
    Array.isArray(shadow) &&
    shadow.length === grid.length &&
    shadow.every((row) => typeof row === 'string' && row.length === width)
  if (!shaped) return add('shadow는 heights와 같은 모양의 문자열 배열이어야 한다')

  const cells = (shadow as string[]).flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '.' ? [] : [{ c, x, y }])),
  )
  if (cells.some(({ c }) => c < '0' || c > '9')) return add('shadow 값은 점이나 0~9여야 한다')
  if (cells.some(({ x, y }) => grid[y][x] >= 0)) add('바닥 있는 칸에 그림자 다리가 있다')

  // 밝을 때 다리 칸으로 민 상자가 땅 높이로 메우는 칸
  const mismatched = cells.some(({ c, x, y }) =>
    SIDES.some(([dx, dy]) => {
      const h = grid[y + dy]?.[x + dx]
      return h !== undefined && h >= 0 && h !== Number(c)
    }),
  )
  if (mismatched) add('그림자 다리 높이가 이어진 땅 높이와 다르다')
}
