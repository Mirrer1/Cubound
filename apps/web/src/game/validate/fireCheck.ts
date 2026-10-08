import { type CheckContext, isInt, isObject, key } from './stageCheck'

const FIRE_CHARS = '.*#='

export const checkFire = (ctx: CheckContext) => {
  const { data, grid, width, entities, add, isFloor, isWaterCell } = ctx
  const fire = data.fire
  if (fire === undefined) {
    if (isObject(data.rules) && data.rules.chase === true) add('rules.chase 판에 불씨 칸이 없다')
    return
  }

  const shaped =
    Array.isArray(fire) &&
    fire.length === grid.length &&
    fire.every((row) => typeof row === 'string' && row.length === width)
  if (!shaped) {
    add('fire는 heights와 같은 모양의 문자열 배열이어야 한다')
    return
  }

  const rows = fire as string[]
  const cells = rows.flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '.' ? [] : [{ c, x, y }])),
  )
  if (cells.some(({ c }) => !FIRE_CHARS.includes(c))) add('fire 값은 점이나 *, #, =여야 한다')
  if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 불씨나 숯이 있다')
  if (cells.some(isWaterCell)) add('물 칸에 불씨나 숯이 있다')

  const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
  if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 불씨나 숯이 있다')

  const layers: [string, Set<string>][] = [
    ['무너지는', ctx.crackCells],
    ['늪', ctx.swampCells],
    ['버섯', ctx.mushroomCells],
  ]
  layers.forEach(([name, set]) => {
    if (cells.some((cell) => set.has(key(cell)))) add(`${name} 칸에 불씨나 숯이 있다`)
  })

  const onFire = (p: { x: number; y: number }) => (rows[p.y]?.[p.x] ?? '.') !== '.'
  if (isFloor(data.start) && onFire(data.start)) add('start가 불씨나 숯 칸에 있다')
  if (isFloor(data.goal) && onFire(data.goal)) add('goal이 불씨나 숯 칸에 있다')

  entities.forEach((entity, i) => {
    if (!isObject(entity) || !isInt(entity.x) || !isInt(entity.y)) return
    const bridgeBox = entity.type === 'box' && rows[entity.y]?.[entity.x] === '='
    if (onFire({ x: entity.x, y: entity.y }) && !bridgeBox) {
      add(`entities[${i}]가 불씨나 숯 칸에 있다`)
    }
    const path = Array.isArray(entity.cells) ? entity.cells : []
    const onPath = (cell: unknown) =>
      isObject(cell) && isInt(cell.x) && isInt(cell.y) && onFire({ x: cell.x, y: cell.y })
    if (path.some(onPath)) {
      add(`entities[${i}]의 길이 불씨나 숯 칸을 지난다`)
    }
  })

  // 숯에 불을 붙이는 칸, 화로가 들어오면 더할 자리
  const hasSource = cells.some(({ c }) => c === '*')
  if (!hasSource && cells.length > 0) add('불씨 칸 없이 숯이 있다')
  if (!hasSource && isObject(data.rules) && data.rules.chase === true) {
    add('rules.chase 판에 불씨 칸이 없다')
  }
}
