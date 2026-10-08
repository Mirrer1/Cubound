import { CUBE, ICE, type Lane, STONE, type WaterAt, floatShownAt, waterLook } from '../view'
import { NO_CHAIN, clamp01, easeIn, easeOut, lerp, smooth } from './curveFrame'
import { type PathEvent, has, same, segmentsOf, stepAt, stonePath, totalSeconds } from './pathFrame'
import { restartDrop } from './restartFrame'
import {
  MELT_SECONDS,
  PULL_SECONDS,
  type SwampTime,
  elapsedAt,
  freezeEnd,
  moveSeconds,
  pullStart,
  sluicePhase,
  sluiceStart,
  thaws,
} from './timeFrame'
import { frontOf } from './tramFrame'
import { FLOAT, floatGone, floatLevel } from './waterFrame'
import { TILE, toScreen } from '@/game/iso'
import { isIce, waterLevel } from '@/game/rules'
import type { Direction, GameEvent, GameState, Point, Stage } from '@/game/types'

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']

const OFFSET: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

// 끌리거나 밀려 가는 뜬 돌이 더 잠기는 px
const PULL_DIP = 4

// 뜬 돌 뒤 물테 셋, 돌 가운데에서 칸 단위 거리와 상자 폭 배수 크기와 진하기
const WAKE = [
  { behind: 0.28, size: 1.2, opacity: 0.75 },
  { behind: 0.5, size: 0.98, opacity: 0.53 },
  { behind: 0.72, size: 0.76, opacity: 0.31 },
]

// 끌려와 멈출 때 퍼지는 고리, 시작하는 진행도와 칸 폭 배수 크기와 진하기
const SETTLE = { from: 0.7, size: [0.7, 0.95], opacity: 0.4 }

// 녹아 사라지는 돌, fade부터 옅어짐, ring부터 남는 고리의 칸 폭 배수 크기와 진하기
const MELT = { fade: 0.7, ring: 0.55, size: [0.3, 0.62], opacity: 0.6 }

const keyOf = (p: Point) => `${p.x}-${p.y}`

// 언 판에 선 돌 바닥 높이, 같은 높이 땅보다 판이 낮은 만큼 아래
export const floatBase = (water: number) => water - ICE.below / TILE.layer

const isWet = (state: GameState, p: Point) =>
  waterLook(state.stage, p, (q) => waterLevel(state, q)).depth > 0

// 서리 판을 까는 칸, 물과 얼음바닥과 표시가 있는 칸(무너지는 칸, 스위치, 짝 칸) 제외
export const frostGround = (state: GameState, p: Point) =>
  !isWet(state, p) &&
  !isIce(state, p) &&
  !/[1-9]/.test(state.stage.cracks?.[p.y]?.[p.x] ?? '.') &&
  !state.stage.entities.some((e) => (e.type === 'switch' || e.type === 'warp') && same(e, p))

const isWhirl = (stage: Stage, p: Point) =>
  stage.entities.some((e) => e.type === 'whirlpool' && same(e, p))

// 언 칸과 그 칸에서 얼린 돌 쪽 방향, 돌이 선 칸 제외
export const frozenCells = (state: GameState) => {
  const cells = new Map<string, Direction>()
  for (const stone of state.stones) {
    for (const toward of DIRECTIONS) {
      const p = { x: stone.x - OFFSET[toward].x, y: stone.y - OFFSET[toward].y }
      const key = keyOf(p)
      if (cells.has(key) || !isWet(state, p) || isWhirl(state.stage, p)) continue
      if (!has(state.stones, p)) cells.set(key, toward)
    }
  }
  return cells
}

export interface IceCover {
  cover: number // 붙은 쪽 가장자리에서 덮은 정도
  from: Direction // 얼린 돌 쪽
  gloss: number // 반짝임 줄 진하기, 돌이 떠난 칸은 얼음 연출 끝 무렵부터, 돌이 떠나 녹는 칸은 0
}

// 그 순간 언 칸마다 덮인 정도, 돌이 막 들어선 칸은 그 수 동안 덮인 채, 돌이 막 떠난 칸은 처음부터 덮인 채
export const iceCovers = (
  before: GameState,
  game: GameState,
  phase: number,
  thaw = phase,
  pulledFrom: Point[] = [],
) => {
  const was = frozenCells(before)
  const now = frozenCells(game)
  const covers = new Map<string, IceCover>()
  now.forEach((from, key) => {
    const left = before.stones.some((s) => keyOf(s) === key)
    const cover = was.has(key) || left ? 1 : phase
    covers.set(key, { cover, from, gloss: clamp01((left ? phase : cover) * 5 - 4) })
  })
  was.forEach((from, key) => {
    if (now.has(key)) return
    const entered = game.stones.some((s) => keyOf(s) === key)
    const [x, y] = key.split('-').map(Number)
    const toward = { x: x + OFFSET[from].x, y: y + OFFSET[from].y }
    const cover = entered ? 1 : 1 - thaw
    // 끌려 나간 돌 뒤는 녹기 시작하고 첫 3분의 1 동안만 남는 줄
    const gloss = has(game.stones, toward)
      ? cover
      : has(pulledFrom, toward)
        ? clamp01(cover * 3 - 2)
        : 0
    covers.set(key, { cover, from, gloss: entered ? 1 : gloss })
  })
  return covers
}

// 밀려 가는 돌이 수면에 닿는 때, 마지막 걸음이 물로 띄우기가 아니면 null
const floatEntry = (before: GameState, events: GameEvent[]) => {
  const path = stonePath(events)
  const segments = segmentsOf(path)
  const last = segments.at(-1)
  if (!last || last.event.type !== 'pushed' || last.event.result !== 'floated') return null

  const first = path[0].from
  const water = floatBase(waterLevel(before, first))
  const start = isWet(before, first) ? water : before.heights[first.y][first.x]
  const from = path.slice(0, -1).reduce((level, e) => levelAfter(before, level, e), start)
  // floatLevel이 수면 높이를 지나는 진행도, smooth의 역함수를 반으로 나눠 찾음
  const target = Math.max(0, from - water) / (Math.max(0, from - water) + FLOAT.sink)
  let [lo, hi] = [0, 1]
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2
    if (smooth(mid) < target) lo = mid
    else hi = mid
  }
  const p = FLOAT.drop + hi * (FLOAT.rise - FLOAT.drop)
  return totalSeconds(segments) - last.seconds * (1 - p)
}

// 들어선 때부터 끝까지 덮여 가는 진행도
const fromEntry = (elapsed: number, entry: number, end: number) =>
  smooth(clamp01((elapsed - entry) / Math.max(end - entry, 1e-6)))

// 그 순간 언 칸, 물에 밀자마자 끌리는 돌은 먼저 들어간 자리 둘레가 얼고 끌려가며 같이 옮겨 감
// 물로 들어가는 돌의 새 둘레는 돌이 내려앉기 시작할 때부터, 옛 둘레는 밀기 시작부터
export const iceCoversAt = (
  before: GameState,
  game: GameState,
  events: GameEvent[],
  t: number,
  swamp: SwampTime,
) => {
  const path = stonePath(events)
  const pushedTo = path.at(-1)?.to
  const pull = events.find(
    (e): e is StonePulled => e.type === 'stonePulled' && !!pushedTo && same(e.from, pushedTo),
  )
  const entry = floatEntry(before, events)
  const elapsed = elapsedAt(events, swamp, t)
  const phase = icePhase(events, t, swamp)
  const pulledFrom = events.flatMap((e) => (e.type === 'stonePulled' ? [e.from] : []))
  // 물이 바뀌어 얼고 녹는 칸, 녹는 칸은 꼭지가 잠기기 시작할 때부터 얼음 녹는 시간 동안, 어는 칸은 수면이 반쯤 오른 뒤
  if (path.length === 0 && sluiceStart(events) !== null) {
    const flood = sluicePhase(events, t, swamp)
    const pulls = events.filter((e): e is StonePulled => e.type === 'stonePulled')
    if (pulls.length === 0) return iceCovers(before, game, flood.freeze, flood.thaw)

    // 떠서 끌리는 돌은 끌리기 전까지 제자리 기준
    const risen = {
      ...game,
      stones: game.stones.map((s) => pulls.find((e) => same(e.to, s))?.from ?? s),
    }
    const start = pullStart(events)
    if (elapsed >= start) {
      const pulling = smooth(clamp01((elapsed - start) / PULL_SECONDS))
      return iceCovers(risen, game, pulling, pulling, pulledFrom)
    }

    return iceCovers(before, risen, flood.freeze, flood.thaw)
  }
  if (!pull || !pushedTo) {
    const end = Math.max(totalSeconds(segmentsOf(path)), freezeEnd(events))
    const covering = entry === null ? phase : fromEntry(elapsed, entry, end)
    return iceCovers(before, game, covering, phase, pulledFrom)
  }

  const mid = {
    ...before,
    stones: before.stones.map((s) => (same(s, path[0].from) ? pushedTo : s)),
  }
  const start = pullStart(events)
  const toPull = smooth(clamp01(elapsed / Math.max(start, 1e-6)))
  return elapsed < start
    ? iceCovers(before, mid, entry === null ? toPull : fromEntry(elapsed, entry, start), toPull)
    : iceCovers(mid, game, smooth(clamp01((elapsed - start) / PULL_SECONDS)), undefined, pulledFrom)
}

// 얼음이 덮이고 물러나는 진행도, 돌이 밀리거나 끌리거나 녹는 동안
export const icePhase = (events: GameEvent[], t: number, swamp: SwampTime) => {
  const windows: [number, number][] = []
  const path = stonePath(events)
  const push = totalSeconds(segmentsOf(path))
  // 같은 수에 끌려갈 돌은 끌려가는 동안 바뀌는 얼음, 밀려 들어간 칸의 둘레는 남지 않는 몫
  const pushedTo = path.at(-1)?.to
  const pulledAway = events.some(
    (e) => e.type === 'stonePulled' && pushedTo && same(e.from, pushedTo),
  )
  if (push > 0 && !pulledAway)
    windows.push([0, thaws(events) ? Math.max(push, freezeEnd(events)) : push])
  for (const e of events) {
    if (e.type === 'stonePulled')
      windows.push([pullStart(events), pullStart(events) + PULL_SECONDS])
  }
  const flood = sluiceStart(events)
  if (flood !== null && thaws(events)) windows.push([flood, freezeEnd(events)])
  if (events.some((e) => e.type === 'melted')) {
    const start = moveSeconds(events, swamp) - swamp.lead
    windows.push([start, start + MELT_SECONDS])
  }
  if (windows.length === 0) return smooth(clamp01(t))

  const start = Math.min(...windows.map(([s]) => s))
  const end = Math.max(...windows.map(([, e]) => e))
  return smooth(clamp01((elapsedAt(events, swamp, t) - start) / Math.max(end - start, 1e-6)))
}

export interface StoneFrame {
  x: number
  y: number // 돌 바닥 중심
  scale: number // 녹으며 줄어든 비율
  cut: number // 아랫단이 잠긴 px
  slab: number // 돌 밑 얼음 판 크기 비율, 0이면 판 없는 땅 위 돌
  bare?: boolean // 둘레 얼음이 덮고 있어 판 없이 그림자 선만 그리는 물 위 이동
  frost: number // 땅 위 돌 밑 서리 진하기
  opacity: number
  pulled: boolean
  to: Point
  cell: Point // 덮이는 순서가 맞게 그리는 칸
  wake: { x: number; y: number; width: number; opacity: number }[] // 수면 위 물테
  ring: { x: number; y: number; size: number; opacity: number } | null // 칸 폭 배수 크기
}

interface StoneView {
  prev: GameState | null
  game: GameState
  events: GameEvent[]
  t: number
  swamp: SwampTime
  waterAt?: WaterAt // 그 순간 칸의 물 높이, 물이 바뀌는 수에 쓰는 값
}

const surfaceY = (game: GameState, p: Point) =>
  toScreen(p, floatBase(waterLevel(game, { x: Math.round(p.x), y: Math.round(p.y) }))).y

const wakeOf = (game: GameState, at: Point, from: Point, to: Point, strength: number) =>
  strength > 0
    ? WAKE.map((w) => {
        const q = { x: at.x - (to.x - from.x) * w.behind, y: at.y - (to.y - from.y) * w.behind }
        return {
          x: toScreen(q, 0).x,
          y: surfaceY(game, q),
          width: TILE.width * CUBE * w.size,
          opacity: w.opacity * strength,
        }
      })
    : []

const levelAfter = (prev: GameState, level: number, event: PathEvent) =>
  event.type !== 'pushed'
    ? level
    : event.result === 'floated'
      ? floatBase(waterLevel(prev, event.to))
      : event.result === 'fell'
        ? prev.heights[event.to.y][event.to.x]
        : event.result === 'filled'
          ? level - 1
          : level

// 밀려 가는 돌, 물로 들어가면 내려앉으며 판이 깔리고 아랫단이 잠김
const pushedFrame = (view: StoneView, prev: GameState, elapsed: number): StoneFrame | null => {
  const path = stonePath(view.events)
  const step = stepAt(segmentsOf(path), elapsed, NO_CHAIN)
  if (!step) return null

  const { event, index, p } = step
  const first = path[0].from
  const wet = isWet(prev, first)
  const start = wet ? floatBase(waterLevel(prev, first)) : prev.heights[first.y][first.x]
  const fromLevel = path.slice(0, index).reduce((level, e) => levelAfter(prev, level, e), start)
  const toLevel = levelAfter(prev, fromLevel, event)
  const result = event.type === 'pushed' ? event.result : 'slid'
  const floated = result === 'floated'
  const gone = floated ? floatGone(p) : p
  const level = floated
    ? floatLevel(fromLevel, toLevel, p)
    : result === 'filled'
      ? p < 0.5
        ? fromLevel
        : lerp(fromLevel, toLevel, smooth((p - 0.5) / 0.5))
      : result === 'fell' && p >= 0.6
        ? lerp(fromLevel, toLevel, easeIn((p - 0.6) / 0.4))
        : fromLevel
  // 물로 들어가는 돌의 얼음 판은 수면 아래로 잠기는 동안 차오름
  const sunk = p >= FLOAT.rise ? 1 : smooth(clamp01((toLevel - level) / FLOAT.sink))
  const slab = wet ? 1 : floated ? sunk : 0
  const at = {
    x: lerp(event.from.x, event.to.x, gone),
    y: lerp(event.from.y, event.to.y, gone),
  }
  const screen = toScreen(at, level)

  return {
    x: screen.x,
    y: screen.y + (wet ? PULL_DIP * Math.sin(Math.PI * p) : 0),
    scale: 1,
    cut: STONE.floatCut * slab,
    slab,
    bare: wet,
    frost: 0,
    opacity: 1,
    pulled: false,
    to: path[path.length - 1].to,
    cell: frontOf(event.from, event.to),
    wake: [],
    ring: null,
  }
}

// 돌이 밀려 떠나는 칸과 도착하는 칸의 땅 서리 진하기, 떠나는 칸은 앞 절반에 옅어지고 도착하는 칸은 뒤 절반에 생김
export const frostPatches = (
  prev: GameState,
  game: GameState,
  events: GameEvent[],
  t: number,
  swamp: SwampTime,
) => {
  const patches = new Map<string, number>()
  const path = stonePath(events)
  const seconds = totalSeconds(segmentsOf(path))
  if (path.length === 0 || seconds <= 0) return patches

  const p = clamp01(elapsedAt(events, swamp, t) / seconds)
  const from = path[0].from
  const to = path[path.length - 1].to
  if (frostGround(prev, from)) patches.set(keyOf(from), 1 - smooth(clamp01(p / 0.5)))
  if (has(game.stones, to) && frostGround(game, to))
    patches.set(keyOf(to), smooth(clamp01((p - 0.5) / 0.5)))
  return patches
}

type StonePulled = Extract<GameEvent, { type: 'stonePulled' }>

// 소용돌이에 한 칸 끌려가는 뜬 돌, 끌린 배와 같은 결
const pulledFrame = (view: StoneView, event: StonePulled, elapsed: number): StoneFrame => {
  const { game, events } = view
  const start = pullStart(events)
  const p = clamp01((elapsed - start) / PULL_SECONDS)
  const at = {
    x: lerp(event.from.x, event.to.x, smooth(p)),
    y: lerp(event.from.y, event.to.y, smooth(p)),
  }
  const levelAt = (cell: Point) => (view.waterAt ? view.waterAt(cell) : waterLevel(game, cell))
  // 땅에서 뜨는 돌은 수면이 덮은 만큼만 잠기고 들어 올릴 만큼 차야 뜸
  const level = levelAt(event.from)
  const floor = game.stage.heights[event.from.y][event.from.x]
  const screen = toScreen(at, Math.max(floor, floatBase(level)))
  const cut = Math.min(STONE.floatCut, Math.max(0, (level - floor) * TILE.layer))
  const afloat = cut / STONE.floatCut
  const r = clamp01((p - SETTLE.from) / (1 - SETTLE.from))
  const ringAt = toScreen(event.to, floatBase(levelAt(event.to)))

  return {
    x: screen.x,
    y: screen.y + PULL_DIP * Math.sin(Math.PI * p),
    scale: 1,
    cut,
    slab: afloat,
    bare: elapsed >= start,
    frost: view.prev && frostGround(view.prev, event.from) ? 1 - afloat : 0,
    opacity: 1,
    pulled: true,
    to: event.to,
    cell: p > 0 ? frontOf(event.from, event.to) : event.from,
    wake: wakeOf(game, at, event.from, event.to, Math.sin(Math.PI * p)),
    ring:
      r > 0 && r < 1
        ? {
            x: ringAt.x,
            y: ringAt.y,
            size: lerp(SETTLE.size[0], SETTLE.size[1], easeOut(r)),
            opacity: SETTLE.opacity * Math.sin(Math.PI * r),
          }
        : null,
  }
}

// 0이 된 수 끝에 작아지며 가라앉는 돌과 마지막에 남는 고리
const meltingFrame = (view: StoneView, at: Point, elapsed: number): StoneFrame => {
  const { game, events, swamp } = view
  const m = clamp01((elapsed - moveSeconds(events, swamp) + swamp.lead) / MELT_SECONDS)
  const screen = toScreen(at, floatBase(waterLevel(game, at)))
  const r = clamp01((m - MELT.ring) / (1 - MELT.ring))

  return {
    x: screen.x,
    y: screen.y,
    scale: 1 - 0.5 * m,
    cut: STONE.floatCut + STONE.meltCut * m,
    slab: 1 - 0.6 * m,
    frost: 0,
    opacity: 1 - smooth(clamp01((m - MELT.fade) / (1 - MELT.fade))),
    pulled: false,
    to: at,
    cell: at,
    wake: [],
    ring:
      r > 0 && r < 1
        ? {
            x: screen.x,
            y: screen.y,
            size: lerp(MELT.size[0], MELT.size[1], easeOut(r)),
            opacity: MELT.opacity * Math.sin(Math.PI * r),
          }
        : null,
  }
}

// 칸과 따로 그리는 움직이는 돌, 멈춘 돌은 칸 그림 몫
export const stoneFrames = (view: StoneView): StoneFrame[] => {
  const { prev, events, t, swamp } = view
  if (!prev || t >= 1) return []

  const elapsed = elapsedAt(events, swamp, t)
  const path = stonePath(events)
  const pushedTo = path.at(-1)?.to
  const pulls = events.filter((e): e is StonePulled => e.type === 'stonePulled')
  const melted = events.find((e) => e.type === 'melted')
  const meltStart = moveSeconds(events, swamp) - swamp.lead
  const frames: StoneFrame[] = []

  const handed = pulls.some(
    (e) => pushedTo && same(e.from, pushedTo) && elapsed >= pullStart(events),
  )
  if (pushedTo && elapsed < totalSeconds(segmentsOf(path)) && !handed) {
    const frame = pushedFrame(view, prev, elapsed)
    // 같은 수에 끌려갈 돌은 끌려갈 칸까지 이 그림 몫
    const pulledTo = pulls.find((e) => same(e.from, pushedTo))?.to
    if (frame) frames.push({ ...frame, to: pulledTo ?? frame.to })
  }
  for (const e of pulls) {
    const pushedHere = pushedTo !== undefined && same(e.from, pushedTo) && !handed
    const melting = melted?.type === 'melted' && same(melted.at, e.to) && elapsed >= meltStart
    if (!pushedHere && !melting) frames.push(pulledFrame(view, e, elapsed))
  }
  if (
    melted?.type === 'melted' &&
    (elapsed >= meltStart || !pulls.some((e) => same(e.to, melted.at)))
  ) {
    frames.push(meltingFrame(view, melted.at, elapsed))
  }
  return frames
}

// 칸이 녹아 내려앉는 언 칸 위 상자의 바닥 높이와 윗면 중심, 수면 위로 보이는 px
export const thawingBoxes = (before: GameState, game: GameState, phase: number) => {
  return before.iced
    .filter((p) => !has(game.iced, p) && has(game.boxes, p) && isWet(game, p))
    .map((p) => {
      const water = waterLevel(game, p)
      // 얼음이 물러나기 시작할 때부터 내려앉는 몫, 띄우기 곡선의 기다림 구간 제외
      const level = floatLevel(floatBase(water), water - 1, lerp(FLOAT.drop, 1, phase))
      return {
        to: p,
        level,
        y: toScreen(p, level).y - TILE.layer,
        shown: floatShownAt(game.stage, { ...p, level }) ?? TILE.layer,
      }
    })
}

// 언 판이 땅보다 낮은 만큼 내려앉는 큐브, 얼어붙은 배 위는 제외
export const iceSink = (covers: Map<string, IceCover>, game: GameState, x: number, y: number) => {
  const sinkAt = (p: Point) => {
    const cover = covers.get(keyOf(p))?.cover ?? 0
    const lockedBoat = has(game.boxes, p) && !has(game.iced, p)
    return lockedBoat ? 0 : cover * ICE.below
  }
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const near = lerp(sinkAt({ x: x0, y: y0 }), sinkAt({ x: x0 + 1, y: y0 }), x - x0)
  const far = lerp(sinkAt({ x: x0, y: y0 + 1 }), sinkAt({ x: x0 + 1, y: y0 + 1 }), x - x0)
  return lerp(near, far, y - y0)
}

// 물길 띠 진하기, 줄 밖 돌이 얼린 칸 너머는 소용돌이에 끊긴 띠
export const laneShown = (
  lanes: Map<string, Lane>,
  before: GameState,
  game: GameState,
  phase: number,
) => {
  const cut = (state: GameState, p: Point, lane: Lane) => {
    const offLine = (q: Point) =>
      state.stones.some((s) => {
        const own = lanes.get(keyOf(s))
        const near = Math.abs(s.x - q.x) + Math.abs(s.y - q.y) === 1
        return near && !(own && own.whirl === lane.whirl && own.axis === lane.axis)
      })
    const toward = OFFSET[lane.toward]
    for (let q = { x: p.x + toward.x, y: p.y + toward.y }; lanes.has(keyOf(q));) {
      if (offLine(q)) return true
      q = { x: q.x + toward.x, y: q.y + toward.y }
    }
    return false
  }
  const shown = new Map<string, number>()
  lanes.forEach((lane, key) => {
    const [x, y] = key.split('-').map(Number)
    const p = { x, y }
    shown.set(key, lerp(cut(before, p, lane) ? 0 : 1, cut(game, p, lane) ? 0 : 1, phase))
  })
  return shown
}

// 녹는 판의 화면 위 숫자, faint는 뜬 돌이 없어 판 숫자를 보이는 때, holding은 큐브가 둘레에 서서 0에 버티는 때
// melting은 돌이 녹는 수의 연출 동안 보이는 0
export const meltDisplay = (
  game: GameState | null,
  events: GameEvent[] = [],
  animating = false,
) => {
  const rule = game?.stage.rules?.melt
  if (!game || rule === undefined) return null

  const melting = animating && events.some((e) => e.type === 'melted')
  return {
    count: melting ? 0 : (game.melt ?? rule),
    faint: !melting && game.melt === null,
    holding: game.melt === 0,
    melting,
  }
}

// 재시작할 때 상자 뒤에 안쪽 돌부터 차례로 내려앉는 돌, 물에 뜬 돌의 얼음 판과 땅 위 돌의 서리 판은 거의 닿을 때 차오름
export const restartStones = (game: GameState, t: number): StoneFrame[] => {
  const n = game.stones.length
  const order = [...game.stones].sort((a, b) => a.x + a.y - (b.x + b.y))
  return game.stones.map((p) => {
    const rank = n > 1 ? order.indexOf(p) / (n - 1) : 0
    const drop = restartDrop(t, game.boxes.length, game.boxes.length, n, rank)
    const float = isWet(game, p)
    const level = float ? floatBase(waterLevel(game, p)) : game.heights[p.y][p.x]
    return {
      x: toScreen(p, level).x,
      y: toScreen(p, level).y - drop.lift * TILE.layer,
      scale: 1,
      cut: float ? STONE.floatCut : 0,
      slab: float ? clamp01(1 - drop.lift * 4) : 0,
      frost: frostGround(game, p) ? smooth(clamp01(1 - drop.lift * 2)) : 0,
      opacity: drop.opacity,
      pulled: false,
      to: p,
      cell: p,
      wake: [],
      ring: null,
    }
  })
}
