import { createState, move } from './rules'
import type { Direction, GameState, Point, Stage } from './types'

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

// 보스 제한은 빼고 늪이 깊어지는 것과 버섯이 시드는 것은 남긴다.
// 제한이 너무 작을 때도 진짜 최소 이동 수가 나오고 늪에 드는 수와 클리어 조건은 그대로다
const forSearch = (stage: Stage): Stage => {
  const { swampDeepen, mushroomWither } = stage.rules ?? {}
  return {
    ...stage,
    rules: swampDeepen || mushroomWither ? { swampDeepen, mushroomWither } : undefined,
  }
}

// 게임 결과가 같은 상태는 같은 키. deep이 거짓이면 늪 깊이를 뺀다
const stateKey = (state: GameState, deep = true) => {
  const filled = state.heights.flatMap((row, y) =>
    row.flatMap((h, x) => (h === state.stage.heights[y][x] ? [] : [{ x, y }])),
  )
  const leaning = state.leaningLadders.map((l) => `${l.x},${l.y},${l.direction}`).sort()
  // 남은 횟수. 무너져 사라진 칸은 '-', 상자로 메운 칸은 '+'
  const cracks = state.cracks.map(({ x, y, left }) =>
    left >= 0 ? left : state.heights[y][x] < 0 ? '-' : '+',
  )

  return [
    `${state.player.x},${state.player.y}`,
    points(state.boxes),
    points(state.ladders),
    points(filled),
    leaning.join(' '),
    state.carrying,
    ...(cracks.length > 0 ? [cracks.join('')] : []),
    // 늪에 선 같은 자리라도 버둥거린 수가 다르면 다른 상태다
    ...(state.stage.swamp ? [`${state.struggles}`, points(state.swamps)] : []),
    // 시드는 판에서만 버섯이 줄어 상태가 달라진다
    ...(state.stage.rules?.mushroomWither ? [points(state.mushrooms)] : []),
    // 깊어지는 늪은 빠진 횟수에 따라 앞으로 드는 수가 다르다
    ...(deep && state.stage.rules?.swampDeepen ? [`${state.sinks}`] : []),
    ...(state.trams.length > 0
      ? [state.trams.map(({ at, dir }) => `${at}${dir > 0 ? '+' : '-'}`).join(' ')]
      : []),
  ].join('|')
}

// 너비 우선 탐색으로 최소 이동 경로를 찾는다
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

// 깊어지는 늪은 빠진 횟수가 상태에 남아 늪을 드나들수록 끝없이 갈라진다. 펼칠 이동 수를 막는다.
// 보스 이동 제한이 있으면 그 너머는 어차피 못 깨는 수고 없으면 ★★ 기준까지만 본다
const searchDepth = (stage: Stage): number => {
  if (!stage.rules?.swampDeepen) return Infinity

  const limit = stage.rules.moveLimit
  if (limit !== undefined) return limit

  const solved = solve(stage)
  return solved.status === 'solved' ? moveLimit(solved.moves) : Infinity
}

export type PushResult =
  { status: 'solved'; pushes: number } | { status: 'unsolvable' } | { status: 'limit' }

// 미는 이동만 한 걸음으로 치는 너비 우선 탐색으로 가장 적게 미는 풀이를 찾는다
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

          // 민 이동으로만 닿는 상태는 이번 걸음의 밀지 않는 길을 다 훑은 뒤에 판단한다
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
  deepest: number // 펼친 이동 수 상한. 막은 것이 없으면 Infinity
  plain: Map<string, string> // 늪 깊이를 뺀 키. 상한을 둔 판에서만 채운다
}

// 시작에서 닿는 모든 상태를 펼친다. 클리어한 상태와 상한에 닿은 상태는 더 두지 않는다
const explore = (stage: Stage, maxStates: number): Explored | null => {
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
        const { state: moved } = move(state, direction)
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

// 목표에서 역방향으로 훑어 상태마다 목표까지 남은 최소 이동 수를 구한다. 갈 수 없으면 빠진다
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

// 늪 깊이를 뺀 상태로 묶어 목표에 닿을 수 있는지 본다. 깊이는 드는 수만 늘려서 길이 남았느냐와 무관하다
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

export type DeadEndResult =
  | {
      status: 'ok'
      states: number
      dead: number // 목표에 아예 갈 수 없는 상태
      earliest: number | null // 가장 빨리 막히는 이동 수
      beyond: number // 상한 안에 목표까지 못 가는 상태. dead를 포함한다
      beyondEarliest: number | null
      depth: number // 펼친 이동 수 상한
    }
  | { status: 'limit' }

const earliestOf = (keys: string[], found: Explored) =>
  keys.reduce<number | null>((min, key) => Math.min(min ?? Infinity, found.depth.get(key)!), null)

// 목표에 갈 수 없게 된 상태를 센다. 펼칠 이동 수를 막은 판은 상한에 걸린 것도 따로 센다
export const deadEnds = (stage: Stage, { maxStates = 1_000_000 } = {}): DeadEndResult => {
  const found = explore(stage, maxStates)
  if (!found) return { status: 'limit' }

  const left = toGoal(found)
  const good = Number.isFinite(found.deepest) ? canReach(found) : null
  // 펼치지 않은 마지막 깊이 상태는 길이 남았는지 알 수 없어 구조적 막힘으로 세지 않는다
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

// 최소 이동 수와 같은 길이의 풀이가 몇 가지인지 센다
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

// maxMoves 안에 목표까지 갈 수 있는 상태를 센다. 제한이 실수를 만회할 자리를 얼마나 주는지 보는 값이다
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

// ★★ 기준은 스테이지가 정한 보스 이동 제한이고 없으면 best로 계산한 여유다
export const stars = (moves: number, best: number, limit = moveLimit(best)) =>
  moves <= best ? 3 : moves <= limit ? 2 : 1
