import { TIDE_EVERY, WIND_EVERY, createState, move, waterLevel } from './rules'
import type { Direction, GameEvent, GameState, Point, Stage } from './types'

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']
const SLACK = 0.2

export type SolveResult =
  | { status: 'solved'; moves: number; path: Direction[] }
  | { status: 'unsolvable' }
  | { status: 'limit' }

const points = (list: Point[]) =>
  list
    .map(({ x, y }) => `${x},${y}`)
    .sort()
    .join(' ')

// 탐색용 판은 보스 제한만 뺀 판, 늪이 깊어지는 것과 버섯이 시드는 것과 덩굴이 굳는 것과 씨앗이 계속 솟는 것과 바람과 마개와 녹는 얼음과 갑문과 밀물은 유지
// 제한이 너무 작을 때도 진짜 최소 이동 수를 얻는 방법
const forSearch = (stage: Stage): Stage => {
  const { swampDeepen, mushroomWither, vineStop, seedGrow, wind, plug, melt, lock, tide } =
    stage.rules ?? {}
  return {
    ...stage,
    rules:
      swampDeepen || mushroomWither || vineStop || seedGrow || wind || plug || melt || lock || tide
        ? { swampDeepen, mushroomWither, vineStop, seedGrow, wind, plug, melt, lock, tide }
        : undefined,
  }
}

// 게임 결과가 같은 상태는 같은 키, deep이 거짓이면 늪 깊이 제외
const stateKey = (state: GameState, deep = true) => {
  const filled = state.heights.flatMap((row, y) =>
    row.flatMap((h, x) => (h === state.stage.heights[y][x] ? [] : [{ x, y }])),
  )
  const leaning = state.leaningLadders.map((l) => `${l.x},${l.y},${l.direction}`).sort()
  // 남은 횟수, 무너져 사라진 칸은 '-', 상자로 메운 칸은 '+'
  const cracks = state.cracks.map(({ x, y, left }) =>
    left >= 0 ? left : state.heights[y][x] < 0 ? '-' : '+',
  )

  return [
    `${state.player.x},${state.player.y}`,
    points(state.boxes),
    points(state.ladders),
    points(filled),
    leaning.join(' '),
    state.carrying === 'ladder',
    ...(cracks.length > 0 ? [cracks.join('')] : []),
    // 늪에 선 같은 자리라도 버둥거린 수가 다르면 다른 상태
    ...(state.stage.swamp ? [`${state.struggles}`, points(state.swamps)] : []),
    // 버섯이 줄어 상태가 갈리는 것은 시드는 판 한정
    ...(state.stage.rules?.mushroomWither ? [points(state.mushrooms)] : []),
    // 자란 길이는 메운 칸에 들어 있어 굳는 자리에서만 더하는 굳음 여부
    ...(state.stage.rules?.vineStop ? [state.vines.map((v) => (v.stopped ? 1 : 0)).join('')] : []),
    // 같은 칸에 여러 번 심으면 메운 칸 자리만으로는 갈리지 않는 높이, 제자리에서 기다린 수도 다른 상태
    ...(state.stage.entities.some((e) => e.type === 'seed')
      ? [
          state.carrying === 'seed',
          points(state.seeds),
          filled.map(({ x, y }) => `${x},${y},${state.heights[y][x]}`).join(' '),
          state.planted.map(({ x, y, left, rises }) => `${x},${y},${left},${rises}`).join(' '),
        ]
      : []),
    // 같은 자리라도 다음 바람까지 남은 수가 다르면 다른 상태
    ...(state.stage.rules?.wind ? [`${state.moves % WIND_EVERY}`] : []),
    // 같은 자리라도 물 높이와 다음 물때까지 남은 수가 다르면 다른 상태
    ...(state.stage.rules?.tide ? [`${state.moves % (TIDE_EVERY * 2)}`] : []),
    // 깊어지는 늪은 빠진 횟수에 따라 달라지는 앞으로 드는 수
    ...(deep && state.stage.rules?.swampDeepen ? [`${state.sinks}`] : []),
    // 자리 집합만으로는 갈리지 않는 묶인 배와 자유 배의 맞바꿈
    ...(state.tethered.length > 0 ? [state.tethered.map(({ x, y }) => `${x},${y}`).join(' ')] : []),
    // 상자가 사라져 남은 상자 자리만으로는 갈리지 않는 막은 소용돌이
    ...(state.stage.rules?.plug ? [points(state.plugged)] : []),
    // 얼음 돌, 얼어붙은 배와 자리만으로 갈리지 않는 언 칸 위 상자
    ...(state.stage.entities.some((e) => e.type === 'iceStone')
      ? [points(state.stones), points(state.iced)]
      : []),
    ...(state.stage.rules?.melt ? [`${state.melt}`] : []),
    ...(state.trams.length > 0
      ? [state.trams.map(({ at, dir }) => `${at}${dir > 0 ? '+' : '-'}`).join(' ')]
      : []),
  ].join('|')
}

// 너비 우선 탐색으로 찾는 최소 이동 경로
export const solve = (stage: Stage, { maxStates = 1_000_000 } = {}): SolveResult => {
  const start = createState(forSearch(stage))
  const seen = new Map<string, { parent: string | null; direction: Direction | null }>([
    [stateKey(start), { parent: null, direction: null }],
  ])
  let queue: GameState[] = [start]

  while (queue.length > 0) {
    const next: GameState[] = []

    for (const state of queue) {
      const key = stateKey(state)

      for (const direction of DIRECTIONS) {
        const { state: moved } = move(state, direction)
        if (moved === state) continue

        const movedKey = stateKey(moved)
        if (seen.has(movedKey)) continue
        seen.set(movedKey, { parent: key, direction })

        if (moved.cleared) {
          const path: Direction[] = []
          for (let k: string | null = movedKey; k !== null; k = seen.get(k)!.parent) {
            const { direction: d } = seen.get(k)!
            if (d) path.unshift(d)
          }
          return { status: 'solved', moves: path.length, path }
        }

        if (seen.size > maxStates) return { status: 'limit' }
        next.push(moved)
      }
    }

    queue = next
  }

  return { status: 'unsolvable' }
}

// 펼칠 이동 수 상한, 깊어지는 늪은 늪을 드나들수록 상태가 끝없이 갈라지는 탓
// 보스 이동 제한이 있으면 그 제한, 없으면 ★★ 기준
const searchDepth = (stage: Stage): number => {
  if (!stage.rules?.swampDeepen) return Infinity

  const limit = stage.rules.moveLimit
  if (limit !== undefined) return limit

  const solved = solve(stage)
  return solved.status === 'solved' ? moveLimit(solved.moves) : Infinity
}

export type PushResult =
  { status: 'solved'; pushes: number } | { status: 'unsolvable' } | { status: 'limit' }

// 미는 이동만 한 걸음으로 치는 너비 우선 탐색, 가장 적게 미는 풀이
export const minPushes = (stage: Stage, { maxStates = 1_000_000 } = {}): PushResult => {
  const deepest = searchDepth(stage)
  const start = createState(forSearch(stage))
  const seen = new Set<string>([stateKey(start)])
  let layer: GameState[] = [start]
  let pushes = 0

  while (layer.length > 0) {
    const pushedTo: GameState[] = []
    let queue = layer

    while (queue.length > 0) {
      const next: GameState[] = []

      for (const state of queue) {
        if (state.cleared) return { status: 'solved', pushes }

        for (const direction of DIRECTIONS) {
          const { state: moved } = move(state, direction)
          if (moved === state || moved.moves > deepest) continue

          // 민 이동으로만 닿는 상태의 판단은 이번 걸음의 밀지 않는 길을 다 훑은 뒤
          if (moved.pushes > state.pushes) {
            pushedTo.push(moved)
            continue
          }

          const key = stateKey(moved)
          if (seen.has(key)) continue
          if (seen.size > maxStates) return { status: 'limit' }
          seen.add(key)
          next.push(moved)
        }
      }

      queue = next
    }

    layer = pushedTo.filter((state) => {
      const key = stateKey(state)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    pushes += 1
  }

  return { status: 'unsolvable' }
}

interface Explored {
  keys: string[]
  next: Map<string, string[]>
  depth: Map<string, number>
  cleared: Set<string>
  deepest: number // 펼친 이동 수 상한, 막은 것이 없으면 Infinity
  plain: Map<string, string> // 늪 깊이를 뺀 키, 상한을 둔 판에서만 채우는 값
}

// 시작에서 닿는 모든 상태, 클리어한 상태와 상한에 닿은 상태는 더 펼치기 제외
type Visit = (moved: GameState, events: GameEvent[]) => void

const explore = (stage: Stage, maxStates: number, visit?: Visit): Explored | null => {
  const start = createState(forSearch(stage))
  const startKey = stateKey(start)
  const found: Explored = {
    keys: [startKey],
    next: new Map(),
    depth: new Map([[startKey, 0]]),
    cleared: new Set(),
    deepest: searchDepth(stage),
    plain: new Map(),
  }
  const quotient = Number.isFinite(found.deepest)
  if (quotient) found.plain.set(startKey, stateKey(start, false))
  let queue: { key: string; state: GameState }[] = [{ key: startKey, state: start }]
  let depth = 0

  while (queue.length > 0) {
    const later: typeof queue = []
    depth += 1

    for (const { key, state } of queue) {
      const links: string[] = []
      found.next.set(key, links)

      for (const direction of DIRECTIONS) {
        const { state: moved, events } = move(state, direction)
        visit?.(moved, events)
        if (moved === state) continue

        const movedKey = stateKey(moved)
        links.push(movedKey)
        if (found.depth.has(movedKey)) continue

        if (found.keys.length >= maxStates) return null
        found.keys.push(movedKey)
        found.depth.set(movedKey, depth)
        if (quotient) found.plain.set(movedKey, stateKey(moved, false))
        if (moved.cleared) found.cleared.add(movedKey)
        else if (depth < found.deepest) later.push({ key: movedKey, state: moved })
      }
    }

    queue = later
  }

  return found
}

// 목표에서 역방향으로 훑은 상태마다 목표까지 남은 최소 이동 수, 갈 수 없는 상태는 제외
const toGoal = (found: Explored) => {
  const back = new Map<string, string[]>()
  for (const [key, links] of found.next) {
    for (const link of links) back.set(link, [...(back.get(link) ?? []), key])
  }

  const left = new Map<string, number>([...found.cleared].map((key) => [key, 0]))
  let queue = [...found.cleared]
  let moves = 0

  while (queue.length > 0) {
    const later: string[] = []
    moves += 1

    for (const key of queue) {
      for (const parent of back.get(key) ?? []) {
        if (left.has(parent)) continue
        left.set(parent, moves)
        later.push(parent)
      }
    }

    queue = later
  }

  return left
}

// 늪 깊이를 뺀 상태로 묶어 보는 목표 도달 여부, 깊이는 드는 수만 늘리는 값
const canReach = (found: Explored) => {
  const back = new Map<string, string[]>()
  for (const [key, links] of found.next) {
    const from = found.plain.get(key)!
    for (const link of links) {
      const to = found.plain.get(link)!
      back.set(to, [...(back.get(to) ?? []), from])
    }
  }

  const good = new Set([...found.cleared].map((key) => found.plain.get(key)!))
  let queue = [...good]

  while (queue.length > 0) {
    const later: string[] = []

    for (const key of queue) {
      for (const parent of back.get(key) ?? []) {
        if (good.has(parent)) continue
        good.add(parent)
        later.push(parent)
      }
    }

    queue = later
  }

  return good
}

// 시작에서 닿는 모든 이동을 하나씩 넘기는 훑기, 한도를 넘으면 false
export const eachMove = (stage: Stage, visit: Visit, { maxStates = 1_000_000 } = {}) =>
  explore(stage, maxStates, visit) !== null

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

export const moveLimit = (best: number) => best + Math.ceil(best * SLACK)

// ★★ 기준은 스테이지의 보스 이동 제한, 없으면 best로 계산한 여유
export const stars = (moves: number, best: number, limit = moveLimit(best)) =>
  moves <= best ? 3 : moves <= limit ? 2 : 1
