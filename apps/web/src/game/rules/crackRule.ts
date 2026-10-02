import type { GameEvent, GameState, MoveResult, Point } from '../types'
import { hasBox, same } from './cellRule'

// 칸을 딛는 것, 상자 위에 선 큐브는 제외
const restingOn = (state: GameState, p: Point) =>
  hasBox(state, p) ? 'box' : same(state.player, p) ? 'player' : null

// 기대 놓은 사다리가 선 칸은 다 닳아도 유지, 허공에 남는 사다리 방지
const holdsLadder = (state: GameState, p: Point) => state.leaningLadders.some((l) => same(l, p))

// 닳는 칸은 before와 after 사이에 딛는 것이 바뀐 칸, 무너지는 칸은 다 닳고 base에서도 빈 칸
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
