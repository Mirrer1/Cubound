import type { Direction, GameState, Point } from '../types'
import { hasBox, same, step } from './cellRule'
import { floorAt } from './stateRule'
import { isClosedDoor } from './switchRule'

export const isIce = (state: GameState, { x, y }: Point) => state.stage.ice?.[y]?.[x] === '#'

// 상자 위에 올라선 큐브는 얼음 바닥을 밟지 않은 것으로 본다
const onIce = (state: GameState, p: Point) => isIce(state, p) && !hasBox(state, p)

// 얼음에 올라선 큐브가 멈출 칸까지 같은 방향으로 이어서 간다
export const slidePlayer = (
  state: GameState,
  from: Point,
  direction: Direction,
): { rest: Point; landed: Point | null } => {
  const level = floorAt(state, from) ?? 0
  let at = from

  for (;;) {
    if (!onIce(state, at) || same(at, state.stage.goal)) return { rest: at, landed: null }

    const next = step(at, direction)
    const floor = floorAt(state, next)
    if (floor === null || floor > level || hasBox(state, next) || isClosedDoor(state, next)) {
      return { rest: at, landed: null }
    }
    if (floor < level) return { rest: at, landed: next }
    at = next
  }
}
