import type { Direction, GameEvent, GameState, MoveResult, Point } from '../types'
import { isFrozen, isWater, same, step } from './cellRule'

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']

const isPlugged = (state: GameState, p: Point) => state.plugged.some((q) => same(q, p))

export const isWhirlpool = (state: GameState, p: Point) =>
  state.stage.entities.some((e) => e.type === 'whirlpool' && same(e, p)) && !isPlugged(state, p)

// 소용돌이에서 한 방향으로 이어진 물 칸, 가까운 칸부터
const lineFrom = (state: GameState, at: Point, direction: Direction) => {
  const line: Point[] = []
  for (let p = step(at, direction); isWater(state, p); p = step(p, direction)) line.push(p)
  return line
}

// 큐브가 안 탄 뜬 상자와 물에 뜬 얼음 돌을 소용돌이 쪽으로 한 칸씩 끄는 수, 가까운 것부터 옮겨 붙은 줄은 같이 이동
export const pullBoats = (state: GameState): MoveResult => {
  const events: GameEvent[] = []
  let boxes = state.boxes
  let stones = state.stones
  const hasBoat = (p: Point) => boxes.some((box) => same(box, p))
  const hasStone = (p: Point) => stones.some((q) => same(q, p))

  for (const whirlpool of state.stage.entities) {
    if (whirlpool.type !== 'whirlpool' || isPlugged(state, whirlpool)) continue

    for (const direction of DIRECTIONS) {
      const line = lineFrom(state, whirlpool, direction)
      line.forEach((from, i) => {
        const to = line[i - 1]
        const stone = hasStone(from)
        if (!to || same(from, state.player) || !(stone || hasBoat(from))) return
        if (hasBoat(to) || hasStone(to)) return

        const now = { ...state, boxes, stones }
        // 다른 돌이 얼린 칸은 땅처럼 줄을 끊는 칸
        const others = { ...now, stones: stones.filter((q) => !same(q, from)) }
        if (line.slice(0, i).some((p) => isFrozen(others, p))) return

        if (stone) {
          // 큐브가 선 언 칸의 돌은 탄 배처럼 제외
          if (isFrozen({ ...now, stones: [from] }, state.player)) return
          stones = stones.map((q) => (same(q, from) ? to : q))
          events.push({ type: 'stonePulled', from, to })
        } else if (!isFrozen(now, from)) {
          boxes = boxes.map((box) => (same(box, from) ? to : box))
          events.push({ type: 'pulled', from, to })
        }
      })
    }
  }

  return events.length === 0 ? { state, events } : { state: { ...state, boxes, stones }, events }
}
