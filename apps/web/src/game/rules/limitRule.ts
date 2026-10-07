import type { Direction, GameState, Limit, MoveResult } from '../types'
import { TIDE_EVERY, isHighTide } from './tideRule'
import { WIND_EVERY } from './windRule'

// 이동 수를 쓰지 않는 제자리 정지
export const limitBlocked = (state: GameState, direction: Direction, limit: Limit): MoveResult => ({
  state,
  events: [
    { type: 'blocked', direction },
    { type: 'limit', limit },
  ],
})

// 보스 이동 제한이 없으면 null
export const movesLeft = (state: GameState) => {
  const limit = state.stage.rules?.moveLimit
  return limit === undefined ? null : Math.max(limit - state.moves, 0)
}

// 보스 밀기 제한이 없으면 null
export const pushesLeft = (state: GameState) => {
  const limit = state.stage.rules?.pushLimit
  return limit === undefined ? null : Math.max(limit - state.pushes, 0)
}

// 보스 올라가기 제한이 없으면 null
export const climbsLeft = (state: GameState) => {
  const limit = state.stage.rules?.climbLimit
  return limit === undefined ? null : Math.max(limit - state.climbs, 0)
}

// 보스 타는 횟수 제한이 없으면 null
export const ridesLeft = (state: GameState) => {
  const limit = state.stage.rules?.rideLimit
  return limit === undefined ? null : Math.max(limit - state.rides, 0)
}

// 깊어지는 늪이 아니면 null
export const sinkCount = (state: GameState) => (state.stage.rules?.swampDeepen ? state.sinks : null)

// 버섯이 시드는 판이 아니면 null
export const capsLeft = (state: GameState) =>
  state.stage.rules?.mushroomWither ? state.mushrooms.length : null

// 덩굴이 굳는 판이 아니면 null
export const vinesLeft = (state: GameState) =>
  state.stage.rules?.vineStop ? state.vines.filter((vine) => !vine.stopped).length : null

// 바람이 부는 판이 아니면 null
export const windLeft = (state: GameState) =>
  state.stage.rules?.wind ? WIND_EVERY - (state.moves % WIND_EVERY) : null

// 보스 방향 제한이 없으면 null
export const dirLeft = (state: GameState) => {
  const limit = state.stage.rules?.dirLimit
  return limit === undefined ? null : Math.max(limit.count - state.dirUses, 0)
}

// 밀물 판이 아니면 null, up은 다음 물때가 밀물인 경우
export const tideLeft = (state: GameState) =>
  state.stage.rules?.tide
    ? { left: TIDE_EVERY - (state.moves % TIDE_EVERY), up: !isHighTide(state) }
    : null
