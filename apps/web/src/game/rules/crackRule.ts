import type { GameEvent, GameState, MoveResult, Point } from '../types'
import { hasBox, same } from './cellRule'

// 칸을 딛고 있는 것. 상자 위에 선 큐브는 칸을 딛지 않는다
const restingOn = (state: GameState, p: Point) =>
  hasBox(state, p) ? 'box' : same(state.player, p) ? 'player' : null

// 기대 놓은 사다리는 발을 딛고 서 있어 그 칸이 다 닳아도 무너지지 않는다. 사다리가 허공에 남지 않는다
const holdsLadder = (state: GameState, p: Point) => state.leaningLadders.some((l) => same(l, p))

// before에서 after로 딛고 있던 것이 바뀐 무너지는 칸의 남은 횟수를 base에서 줄인다.
// 다 쓰고 수가 끝난 base에서도 비어 있으면 바닥 없는 칸이 된다
export const crumble = (
  before: GameState,
  after: GameState,
  base: GameState = after,
): MoveResult => {
  if (base.cracks.length === 0) return { state: base, events: [] }

  const events: GameEvent[] = []
  const heights = [...base.heights]

  const cracks = base.cracks.map((crack) => {
    const was = restingOn(before, crack)
    const now = restingOn(after, crack)
    if (crack.left < 0 || was === null || was === now) return crack

    const left = Math.max(crack.left - 1, 0)
    const gone = left === 0 && restingOn(base, crack) === null && !holdsLadder(base, crack)
    const { x, y } = crack
    events.push({ type: 'cracked', at: { x, y }, left, gone })
    if (gone) heights[y] = heights[y].map((h, i) => (i === x ? -1 : h))

    return { x, y, left: gone ? -1 : left }
  })

  if (events.length === 0) return { state: base, events }
  return { state: { ...base, cracks, heights }, events }
}
