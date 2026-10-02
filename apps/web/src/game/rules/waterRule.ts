import type { Direction, GameState, MoveResult, Point } from '../types'
import { same } from './cellRule'
import { arrive } from './walkRule'

// 뜬 상자를 탄 큐브가 빈 물 칸 쪽으로 상자와 함께 가는 수
export const row = (state: GameState, to: Point, direction: Direction): MoveResult => {
  const from = state.player
  const boxes = state.boxes.map((box) => (same(box, from) ? to : box))
  return arrive({ ...state, boxes }, to, direction, { type: 'rowed', from, to })
}
