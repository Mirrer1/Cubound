import { type CheckContext, isInt } from './stageCheck'

export const checkWater = ({ data, grid, width, add, isFloor, isWaterCell }: CheckContext) => {
  if (data.water !== undefined && !(isInt(data.water) && data.water > 0)) {
    add('water는 양의 정수여야 한다')
  }

  const masks = [
    ['ice', '얼음'],
    ['swamp', '늪'],
    ['mushroom', '버섯'],
    ['cracks', '무너지는 칸'],
  ]
  masks.forEach(([field, label]) => {
    const mask = data[field]
    const wet =
      Array.isArray(mask) &&
      mask.some(
        (row, y) =>
          typeof row === 'string' &&
          y < grid.length &&
          [...row].some((c, x) => c !== '.' && x < width && isWaterCell({ x, y })),
      )
    if (wet) add(`물 칸에 ${label}이 있다`)
  })

  if (isFloor(data.start) && isWaterCell(data.start)) add('start가 물 칸에 있다')
  if (isFloor(data.goal) && isWaterCell(data.goal)) add('goal이 물 칸에 있다')
}
