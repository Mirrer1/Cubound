import type { GameEvent, GameState, Point } from '../types'
import { same } from './cellRule'
import { nightBeat } from './darkRule'

// 메우지 않은 그림자 다리 칸의 윗면 높이, 다리가 아니거나 메운 칸은 null
const shadowLevel = (state: GameState, { x, y }: Point) => {
  const c = state.stage.shadow?.[y]?.[x]
  return c === undefined || c === '.' || state.heights[y][x] >= 0 ? null : Number(c)
}

const isShadow = (state: GameState, p: Point) => shadowLevel(state, p) !== null

// 어둠 1수 전부터 어둠 끝까지 오를 수 있는 다리 높이
export const shadowFloor = (state: GameState, p: Point) =>
  nightBeat(state) >= 3 ? shadowLevel(state, p) : null

// 밝아지는 수의 다리 위 상자 메움과 큐브 되돌림
export const settleShadow = (
  before: GameState,
  after: GameState,
): { state: GameState; events: GameEvent[] } => {
  if (!after.stage.shadow) return { state: after, events: [] }

  const onBridge = isShadow(after, after.player)
  const entry = !onBridge ? null : isShadow(before, before.player) ? before.entry : before.player
  if (nightBeat(after) !== 0) return { state: { ...after, entry }, events: [] }

  const sunk = after.boxes.filter((box) => isShadow(after, box))
  const heights = after.heights.map((row, y) =>
    row.map((h, x) => (sunk.some((b) => same(b, { x, y })) ? shadowLevel(after, { x, y })! : h)),
  )
  const returned = onBridge && entry ? entry : null
  return {
    state: {
      ...after,
      heights,
      boxes: after.boxes.filter((box) => !sunk.some((b) => same(b, box))),
      player: returned ?? after.player,
      entry: null,
    },
    events: [
      ...sunk.map((at): GameEvent => ({ type: 'shadowFilled', at })),
      ...(returned ? [{ type: 'returned', from: after.player, to: returned } as const] : []),
    ],
  }
}
