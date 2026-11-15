import type { GameState, Stage } from '../types'

// 밝은 네 수와 어두운 두 수의 한 바퀴
export const NIGHT_CYCLE = 6

// 박자 자리 3은 어둠 1수 전, 4와 5는 어둠
export const nightBeat = (state: GameState) => state.moves % NIGHT_CYCLE

export const isNightStage = (stage: Stage) => Number(stage.id.split('-')[0]) >= 21

export const isDark = (state: GameState) => isNightStage(state.stage) && nightBeat(state) >= 4
