import type { GameEvent, GameState, Point, Stage } from '../types'

const NEIGHBORS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]

// 순환 import를 피한 칸 비교
const at = (list: Point[], p: Point) => list.some((q) => q.x === p.x && q.y === p.y)

const sluiceCache = new WeakMap<Stage, Point[]>()

const sluices = (stage: Stage) => {
  let found = sluiceCache.get(stage)
  if (!found) {
    found = stage.entities.filter((e) => e.type === 'sluice')
    sluiceCache.set(stage, found)
  }
  return found
}

const poolCache = new WeakMap<Stage, number[][]>()

// 갑문 판의 칸마다 웅덩이 번호, 가 0과 나 1, 웅덩이 밖은 -1
const poolsOf = (stage: Stage) => {
  const cached = poolCache.get(stage)
  if (cached) return cached

  const { heights, rules } = stage
  const water = stage.water ?? 0
  const pools = heights.map((row) => row.map(() => -1))
  const inPool = (x: number, y: number) => {
    const h = heights[y]?.[x]
    return h !== undefined && h >= 0 && h <= water && pools[y][x] === -1
  }
  const fill = (x: number, y: number, pool: number) => {
    const queue = [[x, y]]
    pools[y][x] = pool
    for (const [cx, cy] of queue) {
      for (const [dx, dy] of NEIGHBORS) {
        if (!inPool(cx + dx, cy + dy)) continue
        pools[cy + dy][cx + dx] = pool
        queue.push([cx + dx, cy + dy])
      }
    }
  }

  if (rules?.lock && inPool(rules.lock.x, rules.lock.y)) fill(rules.lock.x, rules.lock.y, 0)
  heights.forEach((row, y) => row.forEach((_, x) => inPool(x, y) && fill(x, y, 1)))
  poolCache.set(stage, pools)
  return pools
}

const isOn = (state: GameState) =>
  sluices(state.stage).some(
    (p) => at([state.player], p) || at(state.boxes, p) || at(state.stones, p),
  )

// 그 칸의 지금 물 높이, 갑문 판은 웅덩이마다 다른 높이
export const waterLevel = (state: GameState, p: Point) => {
  const { stage } = state
  const water = stage.water ?? 0
  if (sluices(stage).length === 0) return water

  const on = isOn(state)
  if (!stage.rules?.lock) return on ? water + 1 : water

  const pool = poolsOf(stage)[p.y]?.[p.x] ?? -1
  if (pool === -1) return water
  return on === (pool === 1) ? water + 1 : water
}

// 수위 장치가 있는 판에서 물이 오르면 잠기는 땅
export const isFloodable = (stage: Stage, p: Point) =>
  sluices(stage).length > 0 && stage.heights[p.y]?.[p.x] === (stage.water ?? 0)

const isWet = (state: GameState, p: Point) => {
  const h = state.stage.heights[p.y]?.[p.x]
  return h !== undefined && h >= 0 && h < waterLevel(state, p)
}

// 큐브가 선 칸에 물이 차오르는 수, 상자 위는 배가 되는 탓에 제외
export const floodsPlayer = (before: GameState, after: GameState) =>
  isWet(after, after.player) && !isWet(before, after.player) && !at(after.boxes, after.player)

const rowOf = (stage: Stage, pool?: number) =>
  stage.heights.flatMap((row, y) =>
    row.flatMap((_, x) =>
      isFloodable(stage, { x, y }) && (pool === undefined || poolsOf(stage)[y][x] === pool)
        ? [{ x, y }]
        : [],
    ),
  )

// 이번 수에 물이 오르거나 빠진 웅덩이, 갑문 판은 가와 나 두 웅덩이
export const sluiceEvents = (before: GameState, after: GameState): GameEvent[] => {
  const { stage } = after
  if (sluices(stage).length === 0 || isOn(before) === isOn(after)) return []

  const on = isOn(after)
  if (!stage.rules?.lock) return [{ type: 'sluice', up: on, cells: rowOf(stage) }]
  return [
    { type: 'sluice', up: !on, pool: 0, cells: rowOf(stage, 0) },
    { type: 'sluice', up: on, pool: 1, cells: rowOf(stage, 1) },
  ]
}
