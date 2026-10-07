import type { GameState } from '../types'

// 물이 한 번 바뀌기까지 세는 수
export const TIDE_EVERY = 4

// 낮은 물 네 수와 높은 물 네 수의 반복, 판 시작은 낮은 물
export const isHighTide = (state: GameState) =>
  state.stage.rules?.tide === true && Math.floor(state.moves / TIDE_EVERY) % 2 === 1
