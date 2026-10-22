import type { Bar, Direction, GameEvent, GameState, HeldLift, MoveResult, Point } from '../types'
import { shoveBox } from './boxRule'
import { barAt, barCells, hasBar, hasBox, hasKeg, hasStone, same, step } from './cellRule'
import { crumble } from './crackRule'
import { fireAt, isFireBlocked } from './fireRule'
import { floorAt, groundHeight, isBridge, standHeight } from './stateRule'
import { isClosedDoor, isLiftRaised, isSwitchOn, lifts } from './switchRule'
import { onTramPath } from './tramRule'
import { walk } from './walkRule'

const SIDES: Direction[] = ['up', 'right', 'down', 'left']

const BACK: Record<Direction, Direction> = { up: 'down', right: 'left', down: 'up', left: 'right' }

const ahead = (p: Point, direction: Direction, n: number): Point =>
  n === 0 ? p : ahead(step(p, direction), direction, n - 1)

const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

const withBar = (state: GameState, index: number, bar: Bar): GameState => ({
  ...state,
  bars: state.bars.map((b, i) => (i === index ? bar : b)),
})

const occupied = (state: GameState, p: Point) =>
  hasBox(state, p) ||
  hasStone(state, p) ||
  hasKeg(state, p) ||
  hasBar(state, p) ||
  state.ladders.some((l) => same(l, p)) ||
  state.leaningLadders.some((l) => same(l, p)) ||
  state.seeds.some((s) => same(s, p)) ||
  isClosedDoor(state, p) ||
  isFireBlocked(state, p)

// 돌며 쓸고 가는 칸, 구덩이와 낮은 땅은 통과
const sweepable = (state: GameState, p: Point, level: number) => {
  const ground = groundHeight(state, p)
  return ground !== undefined && ground <= level && !occupied(state, p)
}

// 막대가 새로 놓일 칸, 화로와 목표와 발판 길은 제외
const fits = (state: GameState, p: Point, level: number) =>
  sweepable(state, p, level) &&
  fireAt(state.stage, p) !== '@' &&
  !onTramPath(state.stage, p) &&
  !same(p, state.stage.goal) &&
  !same(p, state.player)

// 밑 칸 중 가장 높은 바닥, 밑이 다 구덩이면 그대로인 다리 높이
const restLevel = (state: GameState, cells: Point[], level: number) => {
  const grounds = cells.map((c) => groundHeight(state, c) ?? -1).filter((h) => h >= 0)
  return grounds.length === 0 ? level : Math.max(...grounds)
}

// 받침 없는 다리, 길이 방향 양 끝 바깥 칸 중 구덩이나 판 밖이 있는 경우
export const isFloating = (state: GameState, bar: Bar) => {
  if (!isBridge(state, bar)) return false
  const cells = barCells(bar)
  const ends = [step(cells[0], BACK[bar.dir]), step(cells[cells.length - 1], bar.dir)]
  return ends.some((p) => (groundHeight(state, p) ?? -1) < 0)
}

// 길이 방향은 한 칸, 옆에서 민 끝은 반대쪽 끝이 축인 90도, 가운데는 밀기 불가
export const pushBar = (
  state: GameState,
  index: number,
  cell: Point,
  direction: Direction,
): MoveResult | null => {
  const bar = state.bars[index]
  const cells = barCells(bar)
  const tail = cells[0]
  const head = cells[cells.length - 1]
  const n = bar.length - 1
  const along = direction === bar.dir || direction === BACK[bar.dir]
  if (!along && !same(cell, tail) && !same(cell, head)) return null

  const pivot = along ? null : same(cell, tail) ? head : tail
  const moved: Bar = along
    ? { ...bar, ...step(bar, direction) }
    : same(cell, tail)
      ? { ...bar, ...ahead(head, direction, n), dir: BACK[direction] }
      : { ...bar, dir: direction }
  // 쓸고 가는 칸, 축에서 두 방향 거리 합이 길이 이하인 칸
  const reach = pivot && (same(cell, tail) ? BACK[bar.dir] : bar.dir)
  const swept = reach
    ? Array.from({ length: n * n }, (_, k) => ({ a: (k % n) + 1, b: Math.floor(k / n) + 1 }))
        .filter(({ a, b }) => a + b <= n + 1)
        .map(({ a, b }) => ahead(ahead(pivot, reach, a), direction, b))
    : []

  const entering = barCells(moved).filter((c) => !cells.some((old) => same(old, c)))
  if (!entering.every((c) => fits(state, c, bar.level))) return null
  if (!swept.every((c) => sweepable(state, c, bar.level))) return null

  const lifted = withBar(state, index, moved)
  const placed: Bar = { ...moved, level: restLevel(lifted, barCells(moved), bar.level) }
  const next: GameState = { ...withBar(state, index, placed), pushes: state.pushes + 1 }
  if (isFloating(next, placed)) return null
  // 구덩이 위로 내민 끝은 큐브가 따라 들어갈 바닥이 없어 밀기 불가
  const floor = floorAt(next, cell)
  if (floor === null) return null

  // 한쪽 끝 밑이 막대보다 낮은 땅이면 기울어 닿는 연출 몫
  const tip = barCells(placed).some((c) => {
    const h = next.heights[c.y]?.[c.x] ?? -1
    return h >= 0 && h < placed.level
  })
  const bridge = isBridge(next, placed) && !isBridge(state, bar)
  return walk(next, cell, floor, direction, [
    {
      type: 'barPushed',
      bar: index,
      from: bar,
      to: placed,
      pivot,
      ...(tip ? { tip: true } : {}),
      ...(bridge ? { bridge: true } : {}),
    },
  ])
}

// 막대가 걸친 엘리베이터 발판, 막대 칸이 다 발판이고 함께 움직일 때만 이동
const holdLifts = (before: GameState, state: GameState): HeldLift[] =>
  state.bars
    .flatMap((bar) => {
      const under = barCells(bar).map((c) => lifts(state.stage).find((l) => same(l, c)))
      const ids = under.flatMap((l) => (l ? [l.id] : []))
      const together =
        ids.length === under.length && new Set(ids.map((id) => isSwitchOn(state, id))).size === 1
      return together ? [] : ids.map((id) => ({ id, up: isLiftRaised(before, id) }))
    })
    .sort((a, b) => a.id.localeCompare(b.id))

// 늘어날 칸의 큐브를 한 칸 미는 이동, 화약통 폭발과 같은 막힘
const shovePlayer = (state: GameState, direction: Direction): MoveResult | null => {
  const { player } = state
  const to = step(player, direction)
  const toFloor = floorAt(state, to)
  const bar = barAt(state, to)
  if (
    toFloor === null ||
    toFloor > standHeight(state, player) ||
    isClosedDoor(state, to) ||
    isFireBlocked(state, to) ||
    hasBox(state, to) ||
    hasStone(state, to) ||
    hasKeg(state, to) ||
    (bar >= 0 && !isBridge(state, state.bars[bar]))
  )
    return null

  const walked = walk(state, to, toFloor, direction)
  const worn = crumble(state, walked.state)
  return {
    state: { ...worn.state, moves: state.moves },
    events: [...walked.events, ...worn.events],
  }
}

const grow = (
  state: GameState,
  index: number,
  end: 'head' | 'tail',
  out: GameEvent[],
): GameState | null => {
  const bar = state.bars[index]
  const cells = barCells(bar)
  const direction = end === 'tail' ? BACK[bar.dir] : bar.dir
  const at = step(end === 'tail' ? cells[0] : cells[cells.length - 1], direction)
  const shoved = same(at, state.player)
    ? shovePlayer(state, direction)
    : hasBox(state, at)
      ? shoveBox(state, at, direction)
      : { state, events: [] }
  if (!shoved || !fits(shoved.state, at, bar.level)) return null

  const grown: Bar = { ...bar, ...(end === 'tail' ? at : {}), length: bar.length + 1 }
  const level = restLevel(shoved.state, barCells(grown), bar.level)
  const subject = same(at, state.player) ? 'player' : hasBox(state, at) ? 'box' : null
  out.push({
    type: 'barStretched',
    bar: index,
    at,
    shoved: subject && { subject, from: at, to: step(at, direction) },
  })
  out.push(...shoved.events)
  return withBar(shoved.state, index, { ...grown, level, heat: null })
}

// 달궈진 끝 쪽이 먼저, 막히면 반대쪽 끝, 둘 다 막히면 달궈진 채 대기
const stretch = (state: GameState, index: number, out: GameEvent[]): GameState => {
  const end = state.bars[index].heat
  if (!end) return state
  return (
    grow(state, index, end, out) ??
    grow(state, index, end === 'head' ? 'tail' : 'head', out) ??
    state
  )
}

// 불붙은 숯과 맞닿은 수, 같은 높이 숯에서 먼 쪽 끝으로 달궈짐, 양 끝이 같은 거리면 제외
const heat = (
  unburnt: GameState,
  state: GameState,
  index: number,
  fire: Point[],
  out: GameEvent[],
): GameState => {
  const bar = state.bars[index]
  if (bar.length > 2) return state
  if (bar.heat) return stretch(state, index, out)

  const cells = barCells(bar)
  const touching = fire.filter(
    (f) =>
      unburnt.heights[f.y][f.x] === bar.level &&
      cells.some((c) => same(c, f) || SIDES.some((side) => same(step(c, side), f))),
  )
  if (touching.length === 0) return state

  const near = (p: Point) => Math.min(...touching.map((f) => distance(f, p)))
  const tail = near(cells[0])
  const head = near(cells[cells.length - 1])
  if (tail === head) return state

  const end = tail < head ? 'head' : 'tail'
  out.push({ type: 'barHeated', bar: index, end })
  return stretch(withBar(state, index, { ...bar, heat: end }), index, out)
}

// 수 끝의 막대, 걸친 발판 멈춤과 높이 맞추기와 달군 쇠, unburnt는 이번 수 불 계산 전 상태
export const settleBars = (
  before: GameState,
  unburnt: GameState,
  state: GameState,
  events: GameEvent[],
): MoveResult => {
  if (state.bars.length === 0) return { state, events: [] }

  const out: GameEvent[] = []
  const holding: GameState = { ...state, held: holdLifts(before, state) }
  const settled: GameState = {
    ...holding,
    bars: holding.bars.map((bar, i) => {
      const level = restLevel(holding, barCells(bar), bar.level)
      if (level === bar.level) return bar
      out.push({ type: 'barSettled', bar: i, from: bar.level, to: level })
      return { ...bar, level }
    }),
  }
  if (!state.stage.rules?.forge) return { state: settled, events: out }

  const fire = [
    ...unburnt.burning,
    ...state.burning,
    ...events.flatMap((e) => (e.type === 'kindled' ? [e.at] : [])),
  ]
  const forged = settled.bars.reduce((s, _, i) => heat(unburnt, s, i, fire, out), settled)
  return { state: forged, events: out }
}
