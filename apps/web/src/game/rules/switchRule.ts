import type { GameState, Point, Stage } from '../types'
import { hasBox, hasStone, same } from './cellRule'

export const doors = (stage: Stage) => stage.entities.filter((e) => e.type === 'door')

export const lifts = (stage: Stage) => stage.entities.filter((e) => e.type === 'lift')

const isPressed = (state: GameState, p: Point) =>
  same(state.player, p) || hasBox(state, p) || hasStone(state, p)

const isSwitchOn = (state: GameState, target: string) =>
  state.stage.entities.some(
    (e) => e.type === 'switch' && e.target === target && isPressed(state, e),
  )

// 문이 열리는 경우, 연결된 스위치가 하나라도 눌렸거나 문 위에 무언가 있을 때
export const isDoorOpen = (state: GameState, id: string) =>
  isSwitchOn(state, id) ||
  doors(state.stage).some((door) => door.id === id && isPressed(state, door))

// 위에 선 큐브와 상자도 칸 높이를 따라 함께 오르내리는 발판
export const isLiftRaised = (state: GameState, id: string) => isSwitchOn(state, id)

export const isClosedDoor = (state: GameState, p: Point) =>
  doors(state.stage).some((door) => same(door, p) && !isDoorOpen(state, door.id))
