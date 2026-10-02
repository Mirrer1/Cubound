import type { Direction, GameEvent, GameState, MoveResult, Point } from '../types'
import { pushBox } from './boxRule'
import { same } from './cellRule'
import { pushesLeft } from './limitRule'
import { standHeight } from './stateRule'
import { arrive, walk } from './walkRule'

// 뜬 상자를 탄 큐브가 빈 물 칸 쪽으로 상자와 함께 가는 수
export const row = (state: GameState, to: Point, direction: Direction): MoveResult => {
  const from = state.player
  const boxes = state.boxes.map((box) => (same(box, from) ? to : box))
  return arrive({ ...state, boxes }, to, direction, { type: 'rowed', from, to })
}

// 같은 높이 물가에서 뜬 상자 쪽으로 누른 수, 밀 수 없으면 올라타기
export const shove = (state: GameState, box: Point, direction: Direction): MoveResult => {
  const outOfPushes = pushesLeft(state) === 0
  const pushed = outOfPushes ? null : pushBox(state, box, direction)
  if (pushed) return pushed

  const pre: GameEvent[] = outOfPushes ? [{ type: 'limit', limit: 'pushes' }] : []
  return walk(state, box, standHeight(state, box), direction, pre)
}
