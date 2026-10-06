import type { Direction, GameEvent, GameState, MoveResult, Point } from '../types'
import { boxLanding } from './boxRule'
import { hasBox, hasStone, isFrozen, isWater, same, step } from './cellRule'
import { isIce } from './iceRule'
import { isMushroom } from './mushroomRule'
import { waterLevel } from './sluiceRule'
import { floorAt, standHeight } from './stateRule'
import { isSwamp } from './swampRule'
import { walk } from './walkRule'
import { isWhirlpool } from './whirlpoolRule'

type Leg = {
  from: Point
  to: Point
  level: number
  result: 'slid' | 'fell' | 'filled' | 'floated' | 'rowed'
}

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']

// 땅 위 돌이 한 칸 들어서는 수, 언 칸을 포함한 물 칸의 결과는 뜬 돌
const landStep = (state: GameState, from: Point, direction: Direction): Leg | null => {
  const to = step(from, direction)
  if (isWhirlpool(state, to) || isSwamp(state, to) || isMushroom(state, to)) return null

  const level = floorAt(state, from) ?? 0
  const floor = boxLanding(state, to, level)
  if (floor === null) return null
  // 녹는 판에서 이미 물에 뜬 돌이 있으면 다른 돌은 물 칸 불가
  if (isWater(state, to)) return state.melt !== null ? null : { from, to, level, result: 'floated' }
  return { from, to, level, result: floor < 0 ? 'filled' : floor < level ? 'fell' : 'slid' }
}

// 들어선 칸이 얼음바닥이면 같은 높이로 이어 가는 미끄러짐, 낮은 칸에 닿으면 끝
const landLegs = (state: GameState, stone: Point, direction: Direction): Leg[] | null => {
  const first = landStep(state, stone, direction)
  if (!first) return null

  const legs = [first]
  for (let at = first.to; isIce(state, at); at = legs[legs.length - 1].to) {
    const next = landStep(state, at, direction)
    if (!next) break
    legs.push(next)
    if (next.result !== 'slid') break
  }
  return legs
}

const waterLegs = (state: GameState, stone: Point, direction: Direction): Leg[] | null => {
  const to = step(stone, direction)
  const open =
    isWater(state, to) && !hasBox(state, to) && !hasStone(state, to) && !isWhirlpool(state, to)
  return open ? [{ from: stone, to, level: 0, result: 'rowed' }] : null
}

const legEvents = (legs: Leg[]): GameEvent[] => {
  const [first, ...rest] = legs
  const glides = rest.filter((leg) => leg.result === 'slid')
  const end = rest.at(-1)
  const events: GameEvent[] = [
    { type: 'stonePushed', from: first.from, to: first.to, result: first.result },
  ]
  if (glides.length > 0) {
    events.push({ type: 'slid', subject: 'stone', from: first.to, to: glides.at(-1)!.to })
  }
  if (end && end.result !== 'slid') {
    events.push({ type: 'stonePushed', from: end.from, to: end.to, result: end.result })
  }
  return events
}

// 큐브와 같은 높이의 돌을 미는 수, 물에 뜬 돌은 배처럼 물 칸으로만 한 칸
export const pushStone = (
  state: GameState,
  stone: Point,
  direction: Direction,
): MoveResult | null => {
  const floating = isWater(state, stone)
  const level = floating ? waterLevel(state, stone) : floorAt(state, stone)
  if (level !== standHeight(state, state.player)) return null

  const legs = floating ? waterLegs(state, stone, direction) : landLegs(state, stone, direction)
  if (!legs) return null

  const end = legs[legs.length - 1]
  const filled = end.result === 'filled'
  const entered = !floating && end.result === 'floated'
  const melt = entered ? (state.stage.rules?.melt ?? null) : state.melt

  const next: GameState = {
    ...state,
    stones: filled
      ? state.stones.filter((s) => !same(s, stone))
      : state.stones.map((s) => (same(s, stone) ? end.to : s)),
    heights: filled
      ? state.heights.map((row, y) =>
          y === end.to.y ? row.map((h, x) => (x === end.to.x ? end.level : h)) : row,
        )
      : state.heights,
    melt,
    pushes: state.pushes + 1,
  }
  return walk(next, stone, floorAt(next, stone) ?? 0, direction, legEvents(legs))
}

// 녹는 판의 물에 뜬 돌 숫자와 녹는 때, 둘레 언 칸에 선 큐브가 떠나기까지 0 유지
export const meltStones = (before: GameState, state: GameState): MoveResult => {
  if (state.melt === null) return { state, events: [] }

  const left = before.melt === null ? state.melt : Math.max(state.melt - 1, 0)
  const stone = state.stones.find((s) => isWater(state, s))!
  const standing = isFrozen({ ...state, stones: [stone] }, state.player)
  if (left > 0 || standing) return { state: { ...state, melt: left }, events: [] }

  return {
    state: { ...state, stones: state.stones.filter((s) => !same(s, stone)), melt: null },
    events: [{ type: 'melted', at: stone }],
  }
}

const frozenCells = (state: GameState) =>
  state.stones
    .flatMap((s) => DIRECTIONS.map((d) => step(s, d)))
    .filter((p, i, all) => isFrozen(state, p) && all.findIndex((q) => same(q, p)) === i)

const missing = (cells: Point[], from: Point[]) =>
  cells.filter((p) => !from.some((q) => same(q, p))).sort((a, b) => a.y - b.y || a.x - b.x)

// 녹은 칸의 언 칸 위 상자는 배, 이번 수 전후로 얼고 녹은 칸
export const settleIce = (before: GameState, state: GameState): MoveResult => {
  if (before.stones.length === 0 && state.stones.length === 0) return { state, events: [] }

  const was = frozenCells(before)
  const now = frozenCells(state)
  const froze = missing(now, was)
  const thawed = missing(was, now)
  const iced = state.iced.filter((p) => isFrozen(state, p) && hasBox(state, p))

  return {
    state: iced.length === state.iced.length ? state : { ...state, iced },
    events: [
      ...(froze.length > 0 ? [{ type: 'froze', cells: froze } as const] : []),
      ...(thawed.length > 0 ? [{ type: 'thawed', cells: thawed } as const] : []),
    ],
  }
}
