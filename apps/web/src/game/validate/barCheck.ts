import { type CheckContext, isInt, isObject, key } from './stageCheck'

// 막대와 상호작용을 정하지 않은 요소, 한 판 금지
const BANNED_ENTITIES: [string, string][] = [
  ['vine', '덩굴'],
  ['seed', '씨앗'],
]

type Cell = { x: number; y: number }

export const checkBars = ({ data, grid, entities, add }: CheckContext) => {
  const bars = entities.flatMap((e, i) => (isObject(e) && e.type === 'bar' ? [{ e, i }] : []))
  if (isObject(data.rules) && data.rules.forge === true && bars.length === 0) {
    add('rules.forge 판에 막대가 없다')
  }
  if (bars.length === 0) return

  const fire = Array.isArray(data.fire) ? (data.fire as string[]) : []
  const tramCells = new Set(
    entities.flatMap((e) =>
      isObject(e) && e.type === 'tram' && Array.isArray(e.cells)
        ? e.cells.filter(isObject).map((c) => key(c as Cell))
        : [],
    ),
  )
  const second = (e: Cell & { axis?: unknown }): Cell =>
    e.axis === 'x' ? { x: e.x + 1, y: e.y } : { x: e.x, y: e.y + 1 }
  // 칸마다 놓인 오브젝트 순서, 스위치는 막대가 눌러도 되는 칸이라 제외
  const taken = new Map<string, number[]>()
  const take = (p: Cell, i: number) => taken.set(key(p), [...(taken.get(key(p)) ?? []), i])
  entities.forEach((e, i) => {
    if (isObject(e) && isInt(e.x) && isInt(e.y) && e.type !== 'switch') take(e as Cell, i)
  })
  bars.forEach(({ e, i }) => {
    if (isInt(e.x) && isInt(e.y)) take(second(e as Cell), i)
  })

  bars.forEach(({ e, i }) => {
    if (e.axis !== 'x' && e.axis !== 'y') {
      add(`entities[${i}]의 axis는 x나 y여야 한다`)
      return
    }
    if (!isInt(e.x) || !isInt(e.y)) return
    const first = e as Cell
    const next = second(first)
    const heights = [first, next].map((p) => grid[p.y]?.[p.x] ?? -1)
    if (heights.some((h) => h < 0)) {
      add(`entities[${i}]의 막대 두 칸이 바닥 칸이 아니다`)
      return
    }
    if (heights[0] !== heights[1]) add(`entities[${i}]의 막대 두 칸 높이가 다르다`)
    if ((taken.get(key(next)) ?? []).some((j) => j !== i)) {
      add(`entities[${i}]의 막대가 다른 오브젝트와 같은 칸에 있다`)
    }
    if ([data.start, data.goal].some((p) => isObject(p) && key(p as Cell) === key(next))) {
      add(`entities[${i}]의 막대가 시작이나 목표 칸에 있다`)
    }
    const c = fire[next.y]?.[next.x]
    if (c !== undefined && c !== '.' && c !== '=') add(`entities[${i}]가 불씨나 숯 칸에 있다`)
    if ([first, next].some((p) => tramCells.has(key(p)))) {
      add(`entities[${i}]의 막대가 발판 길에 있다`)
    }
  })

  if (data.ice !== undefined) add('막대 판에 얼음이 있다')
  if (data.swamp !== undefined) add('막대 판에 늪이 있다')
  if (data.mushroom !== undefined) add('막대 판에 버섯이 있다')
  if (data.water !== undefined) add('막대 판에 물이 있다')
  if (isObject(data.rules) && data.rules.wind !== undefined) add('막대 판에 바람이 있다')
  BANNED_ENTITIES.forEach(([type, name]) => {
    if (entities.some((e) => isObject(e) && e.type === type)) add(`막대 판에 ${name}이 있다`)
  })
}
