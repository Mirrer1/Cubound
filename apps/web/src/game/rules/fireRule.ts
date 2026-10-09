import type { Direction, GameEvent, GameState, MoveResult, Point, Stage } from '../types'
import { hasBox, same, step } from './cellRule'

const SIDES: Direction[] = ['up', 'right', 'down', 'left']

export const fireAt = (stage: Stage, { x, y }: Point) => stage.fire?.[y]?.[x]

const has = (list: Point[], p: Point) => list.some((q) => same(q, p))

const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

export const readSparks = (stage: Stage): Point[] =>
  (stage.fire ?? []).flatMap((row, y) => [...row].flatMap((c, x) => (c === '*' ? [{ x, y }] : [])))

// 서 있는 숯 벽과 불붙은 숯의 통행 불가
export const isFireBlocked = (state: GameState, p: Point) =>
  (fireAt(state.stage, p) === '#' && !has(state.ashes, p)) || has(state.burning, p)

// 불이 번질 숯, 상자와 기댄 사다리가 올라선 칸은 제외
const isFresh = (state: GameState, p: Point) => {
  const c = fireAt(state.stage, p)
  return (
    (c === '#' || c === '=') &&
    !has(state.burning, p) &&
    !has(state.ashes, p) &&
    !hasBox(state, p) &&
    !state.leaningLadders.some((l) => same(l, p))
  )
}

// 수 끝의 불, 켜기와 번지기와 재, 큐브가 선 불붙은 숯은 떠날 때까지 유지, torched는 이번 수에 큐브가 불을 옮긴 숯 벽
export const burnFire = (state: GameState, torched: Point[] = []): MoveResult => {
  if (!state.stage.fire) return { state, events: [] }

  const { player } = state
  const kindled = hasBox(state, player) ? undefined : state.sparks.find((s) => same(s, player))
  const caught: { from: Point; to: Point }[] = []

  const chasing = state.stage.rules?.chase === true

  // 쫓아오는 판의 갈림길은 큐브와 가장 가까운 갈래만, 거리가 같으면 모두
  const spread = (from: Point) => {
    const fresh = SIDES.map((side) => step(from, side)).filter((to) => isFresh(state, to))
    const nearest = Math.min(...fresh.map((to) => distance(to, player)))
    for (const to of fresh) {
      if (caught.some((c) => same(c.to, to)) || has(torched, to)) continue
      if (chasing && distance(to, player) > nearest) continue
      caught.push({ from, to })
    }
  }

  if (kindled) spread(kindled)
  state.burning.forEach(spread)

  const ashed = state.burning.filter((b) => !same(b, player))
  if (!kindled && caught.length === 0 && ashed.length === 0 && torched.length === 0) {
    return { state, events: [] }
  }

  const bridges = ashed.filter((p) => fireAt(state.stage, p) === '=')
  const heights =
    bridges.length === 0
      ? state.heights
      : state.heights.map((row, y) => row.map((h, x) => (has(bridges, { x, y }) ? -1 : h)))

  const events: GameEvent[] = [
    ...(kindled ? [{ type: 'kindled' as const, at: kindled }] : []),
    ...caught.map(({ from, to }) => ({ type: 'caught' as const, from, to })),
    ...(ashed.length > 0 ? [{ type: 'ashed' as const, cells: ashed }] : []),
  ]

  return {
    state: {
      ...state,
      heights,
      sparks: kindled ? state.sparks.filter((s) => !same(s, kindled)) : state.sparks,
      burning: [
        ...state.burning.filter((b) => same(b, player)),
        ...torched,
        ...caught.map((c) => c.to),
      ],
      ashes: [...state.ashes, ...ashed],
    },
    events,
  }
}
