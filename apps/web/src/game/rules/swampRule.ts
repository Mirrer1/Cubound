import type { GameState, Point } from '../types'
import { same } from './cellRule'

// 늪을 나가기 전 제자리 버둥 수
export const STRUGGLES = 2

export const isSwamp = (state: GameState, p: Point) => state.swamps.some((cell) => same(cell, p))

// 깊어지는 늪의 버둥 수, 지금 선 늪이 몇 번째로 빠진 늪이냐만큼 증가
const strugglesNeeded = (state: GameState) =>
  state.stage.rules?.swampDeepen ? STRUGGLES + state.sinks - 1 : STRUGGLES

export const struggling = (state: GameState) =>
  isSwamp(state, state.player) && state.struggles < strugglesNeeded(state)
