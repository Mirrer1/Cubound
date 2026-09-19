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

// 게임 결과가 같은 상태는 같은 키
const stateKey = (state: GameState) => {
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
  ].join('|')
}

// 너비 우선 탐색으로 최소 이동 경로를 찾는다
export const solve = (stage: Stage, { maxStates = 1_000_000 } = {}): SolveResult => {
  // 보스 이동 제한을 빼고 찾아야 제한이 너무 작을 때도 진짜 최소 이동 수가 나온다
  const start = createState({ ...stage, rules: undefined })
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

export type PushResult =
  { status: 'solved'; pushes: number } | { status: 'unsolvable' } | { status: 'limit' }

// 미는 이동만 한 걸음으로 치는 너비 우선 탐색으로 가장 적게 미는 풀이를 찾는다
export const minPushes = (stage: Stage, { maxStates = 1_000_000 } = {}): PushResult => {
  const start = createState({ ...stage, rules: undefined })
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
          if (moved === state) continue

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
}

// 시작에서 닿는 모든 상태를 펼친다. 클리어한 상태는 더 두지 않는다
const explore = (stage: Stage, maxStates: number): Explored | null => {
  const start = createState({ ...stage, rules: undefined })
  const startKey = stateKey(start)
  const found: Explored = {
    keys: [startKey],
    next: new Map(),
    depth: new Map([[startKey, 0]]),
    cleared: new Set(),
  }
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
        if (moved.cleared) found.cleared.add(movedKey)
        else later.push({ key: movedKey, state: moved })
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

export type DeadEndResult =
  | { status: 'ok'; states: number; dead: number; earliest: number | null } // earliest는 가장 빨리 막히는 이동 수
  | { status: 'limit' }

// 목표에 갈 수 없게 된 상태를 센다
export const deadEnds = (stage: Stage, { maxStates = 1_000_000 } = {}): DeadEndResult => {
  const found = explore(stage, maxStates)
  if (!found) return { status: 'limit' }

  const left = toGoal(found)
  const stuck = found.keys.filter((key) => !left.has(key))
  const earliest = stuck.reduce<number | null>(
    (min, key) => Math.min(min ?? Infinity, found.depth.get(key)!),
    null,
  )

  return { status: 'ok', states: found.keys.length, dead: stuck.length, earliest }
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
