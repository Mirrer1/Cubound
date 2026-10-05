import type { Direction, GameState, Point } from '../types'
import { hasBox, hasStone, isFrozen, same, step } from './cellRule'
import { floorAt } from './stateRule'
import { isClosedDoor } from './switchRule'

export const isIce = (state: GameState, { x, y }: Point) => state.stage.ice?.[y]?.[x] === '#'

// 얼음 위 상자와 얼어붙은 배에 선 큐브는 미끄럼 제외
const onIce = (state: GameState, p: Point) =>
  (isIce(state, p) || isFrozen(state, p)) && !hasBox(state, p)

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
    if (
      floor === null ||
      floor > level ||
      hasBox(state, next) ||
      hasStone(state, next) ||
      isClosedDoor(state, next)
    ) {
      return { rest: at, landed: null }
    }
    if (floor < level) return { rest: at, landed: next }
    at = next
  }
}
