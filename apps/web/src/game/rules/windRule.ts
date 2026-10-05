import type { Direction, GameState, MoveResult } from '../types'
import { hasBox, hasStone, step } from './cellRule'
import { hop, isMushroom, spring } from './mushroomRule'
import { floorAt, standHeight } from './stateRule'
import { isSwamp } from './swampRule'
import { isClosedDoor } from './switchRule'
import { walk } from './walkRule'

// 바람이 한 번 불기까지 세는 수
export const WIND_EVERY = 4

// 그 방향 키를 누른 것과 같은 이동, 상자 밀기와 올라서기와 사다리 놓기와 씨앗 심기 대신 버티기
const windStep = (state: GameState, direction: Direction): MoveResult | null => {
  const from = state.player
  if (isMushroom(state, from)) {
    const hopped = hop(state, from, direction)
    return hopped && spring(state, hopped, direction)
  }

  const to = step(from, direction)
  const toFloor = floorAt(state, to)
  if (toFloor === null || isClosedDoor(state, to) || hasStone(state, to)) return null
  // 기댈 자리인 상자, 상자 위에 선 큐브만 같은 높이의 이웃 상자 윗면으로 이동
  if (hasBox(state, to)) {
    return hasBox(state, from) && toFloor + 1 === standHeight(state, from)
      ? walk(state, to, toFloor + 1, direction)
      : null
  }
  if (toFloor > standHeight(state, from)) return null

  const hopped = isMushroom(state, to) ? hop(state, to, direction) : null
  return hopped ? spring(state, hopped, direction) : walk(state, to, toFloor, direction)
}

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  right: 'left',
  down: 'up',
  left: 'right',
}

// 바람막이 조건, 바람이 오는 쪽 옆 칸이 상자 윗면까지 쳐서 선 높이보다 높은 경우
const sheltered = (state: GameState, direction: Direction) => {
  const upwind = step(state.player, OPPOSITE[direction])
  return (
    floorAt(state, upwind) !== null && standHeight(state, upwind) > standHeight(state, state.player)
  )
}

// 큐브만 미는 바람, 늪에 선 큐브와 숨은 큐브는 예외
export const blow = (state: GameState): MoveResult => {
  const direction = state.stage.rules?.wind
  if (!direction || state.cleared || state.moves % WIND_EVERY !== 0) return { state, events: [] }

  const stuck = isSwamp(state, state.player)
  const hidden = !stuck && sheltered(state, direction)
  const pushed = stuck || hidden ? null : windStep(state, direction)
  if (!pushed) {
    return {
      state,
      events: [{ type: 'braced', direction, ...(hidden ? { sheltered: true as const } : {}) }],
    }
  }

  const from = state.player
  // 바람에 밀린 것은 이동 수에서 제외
  return {
    state: { ...pushed.state, moves: state.moves },
    events: [{ type: 'blown', from, to: step(from, direction), direction }, ...pushed.events],
  }
}
