import type { Direction, GameEvent, GameState, MoveResult, Point, Stage } from '../types'
import { hasBox, same, step } from './cellRule'

const SIDES: Direction[] = ['up', 'right', 'down', 'left']

const fireAt = (stage: Stage, { x, y }: Point) => stage.fire?.[y]?.[x]

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

// 수 끝의 불, 켜기와 번지기와 재, 큐브가 선 불붙은 숯은 떠날 때까지 유지
export const burnFire = (state: GameState): MoveResult => {
  if (!state.stage.fire) return { state, events: [] }

  const { player } = state
  const kindled = hasBox(state, player) ? undefined : state.sparks.find((s) => same(s, player))
  const caught: { from: Point; to: Point }[] = []

  const spread = (from: Point, chasing: boolean) => {
    for (const side of SIDES) {
      const to = step(from, side)
      if (!isFresh(state, to) || caught.some((c) => same(c.to, to))) continue
      if (chasing && distance(to, player) >= distance(from, player)) continue
      caught.push({ from, to })
    }
  }

  // 불씨에서 첫 번짐은 쫓아오는 판에서도 거리 무관
  if (kindled) spread(kindled, false)
  state.burning.forEach((b) => spread(b, state.stage.rules?.chase === true))

  const ashed = state.burning.filter((b) => !same(b, player))
  if (!kindled && caught.length === 0 && ashed.length === 0) return { state, events: [] }

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
      burning: [...state.burning.filter((b) => same(b, player)), ...caught.map((c) => c.to)],
      ashes: [...state.ashes, ...ashed],
    },
    events,
  }
}
