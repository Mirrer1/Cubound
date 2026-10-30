import type { GameEvent, GameState, Point } from '../types'
import { barAt, hasBox, same } from './cellRule'
import { isFresh } from './fireRule'
import { lifts } from './switchRule'
import { tramLevelAt } from './tramRule'

export const TRAIL = 3

// 큐브가 걸어 떠난 땅 칸, 상자와 막대와 발판 위는 제외
const leftGround = (before: GameState, acted: GameState): Point | null => {
  const from = before.player
  if (same(from, acted.player)) return null
  if (hasBox(before, from) || barAt(before, from) >= 0 || tramLevelAt(before, from) !== null) {
    return null
  }
  return lifts(before.stage).some((lift) => same(lift, from)) ? null : from
}

// 수 끝의 꼬리, 떠난 땅 칸은 TRAIL로 켜지고 남은 칸은 1 감소, 안 탄 숯 다리는 꼬리 대신 불붙은 숯
export const burnTrail = (
  before: GameState,
  acted: GameState,
  state: GameState,
): { state: GameState; torched: Point[]; events: GameEvent[] } => {
  if (!state.stage.rules?.trail) return { state, torched: [], events: [] }

  const from = leftGround(before, acted)
  const bridge = from && isFresh(state, from) && state.stage.fire?.[from.y]?.[from.x] === '='
  const lit = from && !bridge && !state.burning.some((b) => same(b, from)) ? from : null

  const out = state.trail.filter((t) => t.left === 1)
  const trail = [
    ...state.trail.filter((t) => t.left > 1).map((t) => ({ ...t, left: t.left - 1 })),
    ...(lit ? [{ x: lit.x, y: lit.y, left: TRAIL }] : []),
  ]
  const events: GameEvent[] = [
    ...out.map(({ x, y }) => ({ type: 'trailOut' as const, at: { x, y } })),
    ...(lit ? [{ type: 'trailLit' as const, at: lit }] : []),
  ]
  return { state: { ...state, trail }, torched: bridge && from ? [from] : [], events }
}
