import type { GameState, Point, Stage } from '../types'
import { hasBox, same } from './cellRule'

export const doors = (stage: Stage) => stage.entities.filter((e) => e.type === 'door')

export const lifts = (stage: Stage) => stage.entities.filter((e) => e.type === 'lift')

const isPressed = (state: GameState, p: Point) => same(state.player, p) || hasBox(state, p)

const isSwitchOn = (state: GameState, target: string) =>
  state.stage.entities.some(
    (e) => e.type === 'switch' && e.target === target && isPressed(state, e),
  )

// 연결된 스위치가 하나라도 눌렸거나 문 위에 무언가 있으면 열림
export const isDoorOpen = (state: GameState, id: string) =>
  isSwitchOn(state, id) ||
  doors(state.stage).some((door) => door.id === id && isPressed(state, door))

// 연결된 스위치가 하나라도 눌려 있으면 한 층 올라간다. 위에 선 큐브와 상자는 따라 오르내린다
export const isLiftRaised = (state: GameState, id: string) => isSwitchOn(state, id)

export const isClosedDoor = (state: GameState, p: Point) =>
  doors(state.stage).some((door) => same(door, p) && !isDoorOpen(state, door.id))
