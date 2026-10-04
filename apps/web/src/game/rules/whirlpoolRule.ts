import type { Direction, GameEvent, GameState, MoveResult, Point } from '../types'
import { isWater, same, step } from './cellRule'

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

// 큐브가 안 탄 뜬 상자를 소용돌이 쪽으로 한 칸씩 끄는 수, 가까운 상자부터 옮겨 붙은 줄은 같이 이동
export const pullBoats = (state: GameState): MoveResult => {
  const events: GameEvent[] = []
  let boxes = state.boxes
  const hasBoat = (p: Point) => boxes.some((box) => same(box, p))

  for (const whirlpool of state.stage.entities) {
    if (whirlpool.type !== 'whirlpool' || isPlugged(state, whirlpool)) continue

    for (const direction of DIRECTIONS) {
      const line = lineFrom(state, whirlpool, direction)
      line.forEach((from, i) => {
        const to = line[i - 1]
        if (!to || same(from, state.player) || !hasBoat(from) || hasBoat(to)) return
        boxes = boxes.map((box) => (same(box, from) ? to : box))
        events.push({ type: 'pulled', from, to })
      })
    }
  }

  return events.length === 0 ? { state, events } : { state: { ...state, boxes }, events }
}
