import type { Direction, GameState, MoveResult, Point } from '../types'
import { hasBox, same } from './cellRule'
import { climbsLeft, limitBlocked } from './limitRule'
import { SEED_WAIT, canPlant, isPlanted } from './seedRule'
import { floorAt, standHeight } from './stateRule'
import { arrive } from './walkRule'

// 한 층 높은 칸 쪽으로 미는 수의 결과, 기댄 사다리로 오르기와 사다리 놓기와 발밑에 씨앗 심기
export const climbOrPlaceLadder = (
  state: GameState,
  to: Point,
  direction: Direction,
): MoveResult | null => {
  const from = state.player
  const toFloor = floorAt(state, to)
  if (hasBox(state, from) || toFloor !== standHeight(state, from) + 1) return null

  if (state.leaningLadders.some((l) => same(l, from) && l.direction === direction)) {
    if (climbsLeft(state) === 0) return limitBlocked(state, direction, 'climbs')

    const climbing: GameState = { ...state, climbs: state.climbs + 1 }
    return arrive(climbing, to, direction, { type: 'climbed', from, to, via: 'ladder' })
  }

  if (state.carrying === 'seed') {
    if (!canPlant(state, from)) return null

    const at = { x: from.x, y: from.y }
    return {
      state: {
        ...state,
        carrying: null,
        planted: [...state.planted, { ...at, left: SEED_WAIT, rises: 0 }],
        moves: state.moves + 1,
      },
      events: [{ type: 'planted', at, direction }],
    }
  }

  // 솟으면 사다리 높이가 어긋나는 심은 칸은 사다리 발치와 기댈 칸 모두 불가
  if (!state.carrying || isPlanted(state, from) || isPlanted(state, to)) return null

  const ladder = { ...from, direction }
  return {
    state: {
      ...state,
      carrying: null,
      leaningLadders: [...state.leaningLadders, ladder],
      moves: state.moves + 1,
    },
    events: [{ type: 'placed', ladder }],
  }
}
