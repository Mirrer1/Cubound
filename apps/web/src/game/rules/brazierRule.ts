import type { GameEvent, GameState, MoveResult, Point } from '../types'
import { hasBox, same } from './cellRule'
import { fireAt } from './fireRule'
import { floorAt, standHeight } from './stateRule'

export const FLAME = 4

export const burnsBox = (state: GameState) => state.flame > 0 && state.stage.rules?.burnBox === true

// 불 붙은 큐브가 숯 벽 쪽으로 미는 수, 한 층 위까지의 벽만 해당하고 큐브는 제자리
export const torch = (state: GameState, to: Point): MoveResult | null => {
  if (state.flame === 0 || fireAt(state.stage, to) !== '#') return null
  if (state.ashes.some((a) => same(a, to)) || state.burning.some((b) => same(b, to))) return null
  if ((floorAt(state, to) ?? Infinity) > standHeight(state, state.player) + 1) return null
  return {
    state: { ...state, moves: state.moves + 1 },
    events: [{ type: 'torched', from: state.player, to }],
  }
}

// 수 끝의 큐브 불, 화로 위나 번진 불이 닿은 칸이면 4로 차고 아니면 1 감소
export const burnFlame = (state: GameState, fireEvents: GameEvent[]): MoveResult => {
  if (!state.stage.fire) return { state, events: [] }

  const { player } = state
  const onBrazier = fireAt(state.stage, player) === '@' && !hasBox(state, player)
  const caught = fireEvents.some((e) => e.type === 'caught' && same(e.to, player))
  const by = onBrazier ? 'brazier' : caught ? 'fire' : null
  const flame = by ? FLAME : Math.max(state.flame - 1, 0)

  const events: GameEvent[] =
    by && state.flame !== FLAME
      ? [{ type: 'ignited', at: player, by }]
      : state.flame > 0 && flame === 0
        ? [{ type: 'doused', at: player }]
        : []
  return { state: flame === state.flame ? state : { ...state, flame }, events }
}
