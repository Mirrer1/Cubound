import { type CheckContext, isInt, isObject, key } from './stageCheck'

const FIRE_CHARS = '.*#=@'

export const checkFire = (ctx: CheckContext) => {
  const { data, grid, width, entities, add, isFloor, isWaterCell } = ctx
  const fire = data.fire
  const rules = isObject(data.rules) ? data.rules : {}
  if (fire === undefined) {
    if (rules.chase === true) add('rules.chase 판에 불씨 칸이 없다')
    if (rules.burnBox === true) add('rules.burnBox 판에 화로가 없다')
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
  if (cells.some(({ c }) => !FIRE_CHARS.includes(c))) add('fire 값은 점이나 *, #, =, @여야 한다')
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

  // 맞닿은 숯 높이 차 한 층까지
  for (const { x, y } of cells) {
    for (const q of [
      { x: x + 1, y },
      { x, y: y + 1 },
    ]) {
      if (onFire(q) && Math.abs(grid[y][x] - grid[q.y][q.x]) >= 2) {
        add(`맞닿은 불씨나 숯 (${x},${y})과 (${q.x},${q.y})의 높이 차가 두 층 이상이다`)
      }
    }
  }

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

  const hasSpark = cells.some(({ c }) => c === '*')
  const hasBrazier = cells.some(({ c }) => c === '@')
  if (!hasSpark && rules.chase === true) add('rules.chase 판에 불씨 칸이 없다')
  if (!hasBrazier && rules.burnBox === true) add('rules.burnBox 판에 화로가 없다')

  // 숯 덩이마다 불이 닿는 길, 맞닿은 불씨 칸이나 화로 판의 숯 벽
  const isChar = (p: { x: number; y: number }) => '#='.includes(rows[p.y]?.[p.x] ?? '.')
  const sides = ({ x, y }: { x: number; y: number }) => [
    { x: x + 1, y },
    { x: x - 1, y },
    { x, y: y + 1 },
    { x, y: y - 1 },
  ]
  const seen = new Set<string>()
  for (const first of cells.filter(isChar)) {
    if (seen.has(key(first))) continue
    const lump: { x: number; y: number }[] = [first]
    seen.add(key(first))
    for (let i = 0; i < lump.length; i++) {
      for (const q of sides(lump[i]).filter((q) => isChar(q) && !seen.has(key(q)))) {
        seen.add(key(q))
        lump.push(q)
      }
    }
    const sparked = lump.some((p) => sides(p).some((q) => rows[q.y]?.[q.x] === '*'))
    const torchable = hasBrazier && lump.some((p) => rows[p.y][p.x] === '#')
    if (!sparked && !torchable) add(`불씨나 화로와 안 이어진 숯이 (${first.x},${first.y})에 있다`)
  }
}
