import type { Direction, GameState, MoveResult, Point } from '../types'
import { same } from './cellRule'
import { moveTethered } from './tetherRule'
import { arrive } from './walkRule'

// 뜬 상자를 탄 큐브가 빈 물 칸 쪽으로 상자와 함께 가는 수
export const row = (state: GameState, to: Point, direction: Direction): MoveResult => {
  const from = state.player
  const boxes = state.boxes.map((box) => (same(box, from) ? to : box))
  const tethered = moveTethered(state, from, to)
  return arrive({ ...state, boxes, tethered }, to, direction, { type: 'rowed', from, to })
}
