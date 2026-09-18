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

  return [
    `${state.player.x},${state.player.y}`,
    points(state.boxes),
    points(state.ladders),
    points(filled),
    leaning.join(' '),
    state.carrying,
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

export const moveLimit = (best: number) => best + Math.ceil(best * SLACK)

// ★★ 기준은 스테이지가 정한 보스 이동 제한이고 없으면 best로 계산한 여유다
export const stars = (moves: number, best: number, limit = moveLimit(best)) =>
  moves <= best ? 3 : moves <= limit ? 2 : 1
