import type { Direction, GameState, Point } from '../types'
import { hasBox, same, step } from './cellRule'
import { isFireBlocked } from './fireRule'
import { floorAt } from './stateRule'
import { isClosedDoor } from './switchRule'
import { walk } from './walkRule'

export const isMushroom = (state: GameState, p: Point) =>
  state.mushrooms.some((cell) => same(cell, p))

// 밟혀 튕긴 버섯이 사라지는 것은 시드는 판 한정
export const wither = (state: GameState, sprung: Point[]) =>
  state.stage.rules?.mushroomWither
    ? state.mushrooms.filter((cell) => !sprung.some((s) => same(s, cell)))
    : state.mushrooms

// 튕긴 큐브가 내려설 자리와 밟고 지난 버섯들, 첫 칸에서 못 뛰면 null
export const hop = (
  state: GameState,
  from: Point,
  direction: Direction,
): { to: Point; height: number; sprung: Point[] } | null => {
  const sprung: Point[] = []
  let at = from

  for (;;) {
    const level = floorAt(state, at) ?? 0
    // 못 뛰면 연쇄가 멈춘 버섯 칸에 제자리 유지
    const stopped = sprung.length > 0 ? { to: at, height: level, sprung } : null
    // 사이 칸은 높이 무관, 벽과 구덩이 모두 통과
    const to = step(step(at, direction), direction)
    const floor = floorAt(state, to)
    if (floor === null || isClosedDoor(state, to) || isFireBlocked(state, to)) return stopped

    const height = floor + (hasBox(state, to) ? 1 : 0)
    if (height > level + 1) return stopped

    sprung.push(at)
    if (!isMushroom(state, to)) return { to, height, sprung }
    at = to
  }
}

export const spring = (
  state: GameState,
  { to, height, sprung }: { to: Point; height: number; sprung: Point[] },
  direction: Direction,
) => walk({ ...state, mushrooms: wither(state, sprung) }, to, height, direction)
