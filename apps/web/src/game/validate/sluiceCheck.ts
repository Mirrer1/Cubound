import { type CheckContext, isInt, isObject, key } from './stageCheck'

const NEIGHBORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

// 물 높이 이하 칸의 4방향 덩이, 높은 땅으로 갈린 덩이 기준
const poolsOf = (grid: number[][], water: number) => {
  const seen = new Set<string>()
  const isPool = (x: number, y: number) => {
    const h = grid[y]?.[x]
    return h !== undefined && h >= 0 && h <= water
  }
  const pools: Set<string>[] = []
  grid.forEach((row, y) =>
    row.forEach((_, x) => {
      if (!isPool(x, y) || seen.has(key({ x, y }))) return
      const pool = new Set([key({ x, y })])
      pools.push(pool)
      const queue = [{ x, y }]
      seen.add(key({ x, y }))
      for (const p of queue) {
        for (const [dx, dy] of NEIGHBORS) {
          const next = { x: p.x + dx, y: p.y + dy }
          if (!isPool(next.x, next.y) || seen.has(key(next))) continue
          seen.add(key(next))
          pool.add(key(next))
          queue.push(next)
        }
      }
    }),
  )
  return pools
}

export const checkSluices = ({ data, grid, entities, add, isFloor }: CheckContext) => {
  const rules = isObject(data.rules) ? data.rules : {}
  const hasSluice = entities.some((e) => isObject(e) && e.type === 'sluice')
  const tide = rules.tide === true
  if (rules.lock !== undefined && !hasSluice) add('rules.lock 판에 수위 장치가 없다')
  if (!hasSluice && !tide) return

  const together = (thing: string) =>
    add(
      tide ? `밀물 판에 ${thing} 같이 둘 수 없다` : `수위 장치와 ${thing} 한 판에 같이 둘 수 없다`,
    )
  if (tide) {
    if (hasSluice) together('물 스위치를')
    const boss = [
      ['lock', 'rules.lock을'],
      ['plug', 'rules.plug를'],
      ['wind', 'rules.wind를'],
    ]
    boss.forEach(([field, label]) => rules[field] !== undefined && together(label))
  }

  if (!isInt(data.water)) {
    add(tide ? '밀물 판에 water가 없다' : '수위 장치 판에 water가 없다')
    return
  }
  const water = data.water
  const isRow = (p: { x: number; y: number }) => grid[p.y]?.[p.x] === water

  entities.forEach((entity, i) => {
    if (!isFloor(entity) || entity.type === 'box' || entity.type === 'iceStone') return
    if (isRow(entity)) add(`entities[${i}]이 물이 오르면 잠기는 칸에 있다`)
  })

  const masks = [
    ['ice', '얼음'],
    ['swamp', '늪'],
    ['mushroom', '버섯'],
    ['cracks', '무너지는 칸'],
  ]
  masks.forEach(([field, label]) => {
    const mask = data[field]
    const marked =
      Array.isArray(mask) &&
      mask.some(
        (row, y) =>
          typeof row === 'string' && [...row].some((c, x) => c !== '.' && isRow({ x, y })),
      )
    if (marked) add(`물이 오르면 잠기는 칸에 ${label}이 있다`)
  })

  const others = [
    ['post', '말뚝'],
    ['lift', '엘리베이터 발판'],
    ['tram', '움직이는 발판'],
  ]
  others.forEach(([type, label]) => {
    if (entities.some((e) => isObject(e) && e.type === type)) together(`${label}을`)
  })
  if (rules.melt !== undefined) together('rules.melt를')

  if (tide || rules.lock === undefined) return
  const lock = rules.lock
  const at = isObject(lock) && isInt(lock.x) && isInt(lock.y) ? { x: lock.x, y: lock.y } : null
  const h = at ? grid[at.y]?.[at.x] : undefined
  if (h === undefined || h < 0 || h > water) add('rules.lock이 웅덩이 칸이 아니다')
  const pools = poolsOf(grid, water)
  if (pools.length !== 2) add('갑문 판의 웅덩이가 둘이 아니다')
  const first = at ? pools.find((pool) => pool.has(key(at))) : undefined
  if (isFloor(data.start) && isRow(data.start) && first?.has(key(data.start))) {
    add('start가 처음부터 차 있는 가 웅덩이의 잠기는 칸에 있다')
  }
}
