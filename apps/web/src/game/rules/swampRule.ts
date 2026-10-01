import type { GameState, Point } from '../types'
import { same } from './cellRule'

// 늪에서 나가기 전에 제자리에서 버둥거리는 수
export const STRUGGLES = 2

export const isSwamp = (state: GameState, p: Point) => state.swamps.some((cell) => same(cell, p))

// 깊어지는 늪에서는 빠진 횟수만큼 버둥이 는다. 지금 선 늪이 몇 번째로 빠진 것이냐로 센다
const strugglesNeeded = (state: GameState) =>
  state.stage.rules?.swampDeepen ? STRUGGLES + state.sinks - 1 : STRUGGLES

// 늪에 선 큐브는 정해진 수를 버둥거린 뒤에야 나갈 수 있다
export const struggling = (state: GameState) =>
  isSwamp(state, state.player) && state.struggles < strugglesNeeded(state)
