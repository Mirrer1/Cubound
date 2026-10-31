import { isFloating, waterLevel } from './rules'
import { DIRECTIONS, type Explored, canReach, eachMove, explore, toGoal } from './solver'
import type { Stage } from './types'

export type DeadEndResult =
  | {
      status: 'ok'
      states: number
      dead: number // 목표에 아예 갈 수 없는 상태
      earliest: number | null // 가장 빨리 막히는 이동 수
      beyond: number // 상한 안에 목표까지 못 가는 상태, dead 포함
      beyondEarliest: number | null
      depth: number // 펼친 이동 수 상한
    }
  | { status: 'limit' }

const earliestOf = (keys: string[], found: Explored) =>
  keys.reduce<number | null>((min, key) => Math.min(min ?? Infinity, found.depth.get(key)!), null)

// 목표에 갈 수 없게 된 상태 수, 펼칠 이동 수를 막은 판은 상한에 걸린 것도 따로 집계
export const deadEnds = (stage: Stage, { maxStates = 1_000_000 } = {}): DeadEndResult => {
  const found = explore(stage, maxStates)
  if (!found) return { status: 'limit' }

  const left = toGoal(found)
  const good = Number.isFinite(found.deepest) ? canReach(found) : null
  // 펼치지 않은 마지막 깊이 상태는 길을 알 수 없어 구조적 막힘에서 제외
  const stuck = found.keys.filter((key) =>
    good ? found.next.has(key) && !good.has(found.plain.get(key)!) : !left.has(key),
  )
  const late = found.keys.filter((key) => {
    const rest = left.get(key)
    return rest === undefined || found.depth.get(key)! + rest > found.deepest
  })

  return {
    status: 'ok',
    states: found.keys.length,
    dead: stuck.length,
    earliest: earliestOf(stuck, found),
    beyond: late.length,
    beyondEarliest: earliestOf(late, found),
    depth: found.deepest,
  }
}

export type CountResult = { status: 'ok'; count: number } | { status: 'limit' }

// 최소 이동 수와 같은 길이의 풀이 가짓수
export const solutionCount = (stage: Stage, { maxStates = 1_000_000 } = {}): CountResult => {
  const found = explore(stage, maxStates)
  if (!found) return { status: 'limit' }
  if (found.cleared.size === 0) return { status: 'ok', count: 0 }

  let ways = new Map<string, number>([[found.keys[0], 1]])

  for (;;) {
    const later = new Map<string, number>()
    let solved = 0

    for (const [key, count] of ways) {
      for (const link of found.next.get(key) ?? []) {
        if (found.cleared.has(link)) solved += count
        else later.set(link, (later.get(link) ?? 0) + count)
      }
    }

    if (solved > 0) return { status: 'ok', count: solved }
    ways = later
  }
}

// 닿을 수 있는 모든 상태에서 큐브가 선 칸에 물이 차올라 막힌 이동 수
export const floodBlocks = (stage: Stage, { maxStates = 1_000_000 } = {}): CountResult => {
  let count = 0
  const done = eachMove(
    stage,
    (_, events) => {
      if (events.some((e) => e.type === 'blocked' && e.flooded)) count += 1
    },
    { maxStates },
  )
  return done ? { status: 'ok', count } : { status: 'limit' }
}

// 닿을 수 있는 모든 상태에서 화약통을 구덩이 쪽으로 밀어 막힌 이동 수
export const kegBlocks = (stage: Stage, { maxStates = 1_000_000 } = {}): CountResult => {
  let count = 0
  const done = eachMove(
    stage,
    (_, events) => {
      if (events.some((e) => e.type === 'blocked' && e.pit)) count += 1
    },
    { maxStates },
  )
  return done ? { status: 'ok', count } : { status: 'limit' }
}

// 닿을 수 있는 모든 상태에서 막대가 받침 없는 다리가 된 이동 수
export const barFloats = (stage: Stage, { maxStates = 1_000_000 } = {}): CountResult => {
  let count = 0
  const done = eachMove(
    stage,
    (moved, events) => {
      const changed = events.some(
        (e) => e.type === 'barPushed' || e.type === 'barSettled' || e.type === 'barStretched',
      )
      if (changed && moved.bars.some((bar) => isFloating(moved, bar))) count += 1
    },
    { maxStates },
  )
  return done ? { status: 'ok', count } : { status: 'limit' }
}

// 닿을 수 있는 모든 상태 중 밀물 수에 네 방향이 다 막혀 시계를 넘길 수 없는 상태 수
export const tideTraps = (stage: Stage, { maxStates = 1_000_000 } = {}): CountResult => {
  let count = 0
  let tried = 0
  let blocked = 0
  let tide = false
  const done = eachMove(
    stage,
    (_, events) => {
      // 펼치는 상태마다 네 방향을 차례로 넘기는 훑기 순서 기준
      if (events.some((e) => e.type === 'blocked')) blocked += 1
      if (events.some((e) => e.type === 'limit' && e.limit === 'tide')) tide = true
      tried += 1
      if (tried < DIRECTIONS.length) return
      if (blocked === DIRECTIONS.length && tide) count += 1
      tried = 0
      blocked = 0
      tide = false
    },
    { maxStates },
  )
  return done ? { status: 'ok', count } : { status: 'limit' }
}

// 닿을 수 있는 모든 상태에서 물 높이와 같은 높이로 메운 구덩이에 물이 오른 이동 수, 메운 칸은 잠기지 않는 규칙이라 판에서 막는 경우
export const filledFloods = (stage: Stage, { maxStates = 1_000_000 } = {}): CountResult => {
  const water = stage.water ?? 0
  let count = 0
  const done = eachMove(
    stage,
    (moved) => {
      const sunk = moved.heights.some((row, y) =>
        row.some(
          (h, x) => stage.heights[y][x] < 0 && h === water && waterLevel(moved, { x, y }) > water,
        ),
      )
      if (sunk) count += 1
    },
    { maxStates },
  )
  return done ? { status: 'ok', count } : { status: 'limit' }
}

// maxMoves 안에 목표까지 갈 수 있는 상태 수, 제한이 실수를 만회할 자리를 얼마나 주는지 보는 값
export const statesWithin = (
  stage: Stage,
  maxMoves: number,
  { maxStates = 1_000_000 } = {},
): CountResult => {
  const found = explore(stage, maxStates)
  if (!found) return { status: 'limit' }

  const left = toGoal(found)
  const inside = found.keys.filter(
    (key) => found.depth.get(key)! + (left.get(key) ?? Infinity) <= maxMoves,
  )

  return { status: 'ok', count: inside.length }
}
