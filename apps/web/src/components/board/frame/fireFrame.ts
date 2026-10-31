import { clamp01, lerp, smooth } from './curveFrame'
import { SECONDS, type Segment, has, same, totalSeconds } from './pathFrame'
import { burnFire } from '@/game/rules'
import type { GameEvent, GameState, Point, Stage } from '@/game/types'

// 불씨가 켜지는 초, 숯이 재로 부서지는 초, 덮여 못 붙은 숯이 올랐다 꺼지는 초
export const FIRE = { kindle: 0.36, ash: 0.5, smother: 1 }

// 달아오른 숯의 heat
const WARM = 0.5

export type FireKind = 'spark' | 'wall' | 'bridge'

const KINDS: Record<string, FireKind> = { '*': 'spark', '#': 'wall', '=': 'bridge' }

export const fireKindAt = (stage: Stage, { x, y }: Point): FireKind | null =>
  KINDS[stage.fire?.[y]?.[x] ?? '.'] ?? null

const warmMemo = new WeakMap<GameState, Point[]>()

// 다음 수 끝에 불붙을 숯, 큐브가 지금 자리에 그대로 있다고 본 값
export const warmCells = (state: GameState): Point[] => {
  if (state.burning.length === 0) return []
  const known = warmMemo.get(state)
  if (known) return known
  const cells = burnFire(state).events.flatMap((e) => (e.type === 'caught' ? [e.to] : []))
  warmMemo.set(state, cells)
  return cells
}

const ashedOf = (events: GameEvent[]) => events.flatMap((e) => (e.type === 'ashed' ? e.cells : []))

const smotheredOf = (events: GameEvent[]) =>
  events.flatMap((e) => (e.type === 'ashed' ? (e.smothered ?? []) : []))

// 재가 되기 시작하는 초, 큐브가 떠나는 칸은 첫 칸 반을 지난 뒤
const ashStart = (p: Point, segments: Segment[]) =>
  segments[0] && same(segments[0].event.from, p) ? segments[0].seconds / 2 : 0

// 덮인 숯이 오르기 시작하는 초, 옆 불이 가장 먼저 부서지기 시작하는 때나 불씨에 닿은 때
const smotherStart = (events: GameEvent[], segments: Segment[], tail: number) => {
  const ashed = ashedOf(events)
  return ashed.length > 0
    ? Math.min(...ashed.map((p) => ashStart(p, segments)))
    : totalSeconds(segments) + tail
}

// 꼬리 불에서 번진 숯이 불붙기 시작하는 초, 꼬리 불이 반쯤 켜진 때
const TRAIL_CATCH = 0.22

// 이 수에 켜진 꼬리 불 칸에서 번진 숯
const trailCaughtOf = (events: GameEvent[]) => {
  const lit = events.flatMap((e) => (e.type === 'trailLit' ? [e.at] : []))
  return events.flatMap((e) => (e.type === 'caught' && has(lit, e.from) ? [e.to] : []))
}

// 꼬리 불에서 번진 숯이 다 불붙는 초, 없으면 0
export const trailCatchEnd = (events: GameEvent[]) =>
  trailCaughtOf(events).length > 0 ? TRAIL_CATCH + SECONDS.moved : 0

// 한꺼번에 붙는 줄에서 불씨로부터 한 칸 깊어질 때마다 늦는 초와 그 상한
const CHAIN = { step: 0.05, max: 0.5 }

// 이 수에 붙은 칸마다 늦는 초, 불씨나 이미 불붙은 칸 바로 옆은 0
const chainDelays = (events: GameEvent[]) => {
  const depths: { at: Point; depth: number }[] = []
  for (const e of events) {
    if (e.type !== 'caught') continue
    const depth = (depths.find((d) => same(d.at, e.from))?.depth ?? 0) + 1
    depths.push({ at: e.to, depth })
  }
  return depths.map(({ at, depth }) => ({
    at,
    delay: Math.min((depth - 1) * CHAIN.step, CHAIN.max),
  }))
}

// 불이 끝나는 초, 켜는 수는 큐브가 닿은 뒤 가장 늦은 칸의 켜짐 시간
export const fireEnd = (events: GameEvent[], segments: Segment[], tail: number) =>
  Math.max(
    0,
    ...ashedOf(events).map((p) => ashStart(p, segments) + FIRE.ash),
    smotheredOf(events).length > 0 ? smotherStart(events, segments, tail) + FIRE.smother : 0,
    events.some((e) => e.type === 'kindled')
      ? totalSeconds(segments) +
          tail +
          FIRE.kindle +
          Math.max(0, ...chainDelays(events).map((c) => c.delay))
      : 0,
  )

interface FireView {
  before: GameState
  game: GameState
  events: GameEvent[]
  moving: boolean
  dropping: boolean
  t: number
  elapsed: number // 이동이 시작한 뒤로 흐른 초
  segments: Segment[]
  tail: number
  stepT: number
}

// 그 순간 판 전체의 불 값
export const fireScene = (view: FireView) => {
  const { before, game, events, moving, dropping, t, elapsed, segments, tail, stepT } = view
  const kindled = moving && events.some((e) => e.type === 'kindled')
  const boss = game.stage.rules?.devour === true
  const kindleStart = totalSeconds(segments) + tail
  return {
    before,
    game,
    dropping,
    elapsed,
    segments,
    boss,
    // 재시작하며 처음 모습으로 돌아가는 진행도
    back: dropping ? smooth(clamp01(t)) : 1,
    // 번짐 진행도, 켜는 수는 큐브가 닿은 뒤
    spread: !moving ? 1 : kindled ? clamp01((elapsed - kindleStart) / FIRE.kindle) : stepT,
    kindleStart,
    // 삼키는 판의 켜는 수에 불씨에서 줄을 따라 늦게 붙는 칸
    chain: boss && kindled && !dropping ? chainDelays(events).filter((c) => c.delay > 0) : [],
    trailCaught: moving && !dropping ? trailCaughtOf(events) : [],
    trailSpread: clamp01((elapsed - TRAIL_CATCH) / SECONDS.moved),
    ashed: moving && !dropping ? ashedOf(events) : [],
    // 옆 불이 꺼지는 수에 불붙음까지 올랐다 천천히 꺼지는 덮인 숯
    blocked: moving && !dropping ? smotheredOf(events) : [],
    blockedStart: smotheredOf(events).length > 0 ? smotherStart(events, segments, tail) : 0,
    warmBefore: moving ? [...warmCells(before), ...coveredCells(before)] : [],
    warmAfter: dropping ? [] : [...warmCells(game), ...coveredCells(game)],
  }
}

const SIDES = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

// 불붙은 숯 옆 같은 높이 숯 중 상자나 기댄 사다리가 덮어 못 붙는 칸, 달아오름으로 보이는 칸
const coveredCells = (state: GameState): Point[] =>
  state.burning.flatMap((p) =>
    SIDES.map((d) => ({ x: p.x + d.x, y: p.y + d.y })).filter(
      (q) =>
        fireKindAt(state.stage, q) !== null &&
        fireKindAt(state.stage, q) !== 'spark' &&
        state.heights[q.y]?.[q.x] === state.heights[p.y][p.x] &&
        !has(state.ashes, q) &&
        !has(state.burning, q) &&
        (has(state.boxes, q) || state.leaningLadders.some((l) => same(l, q))),
    ),
  )

// 덮인 숯이 달아오름에서 불붙음까지 오르는 몫, 옆 숯이 부서지는 동안이고 나머지는 꺼지는 몫
const BLOCKED_RISE = 0.25

const blockedHeat = (u: number, from: number) =>
  u < BLOCKED_RISE
    ? lerp(from, 1, smooth(u / BLOCKED_RISE))
    : lerp(1, 0, smooth((u - BLOCKED_RISE) / (1 - BLOCKED_RISE)))

export type FireScene = ReturnType<typeof fireScene>

export interface FireLook {
  kind: FireKind | null
  heat: number // 0 평소, 0.5 달아오름, 1 불붙음
  lit: number // 불씨 칸 켜짐
  stand: number // 숯이 서 있는 정도, 0이면 재 자국만
  crumble: number // 재로 부서진 정도
  mark: number // 재 자국 진하기
  boss: boolean
}

export const NO_FIRE: FireLook = {
  kind: null,
  heat: 0,
  lit: 0,
  stand: 1,
  crumble: 0,
  mark: 0,
  boss: false,
}

const heatOf = (state: GameState, warm: Point[], p: Point) =>
  has(state.burning, p) ? 1 : has(warm, p) ? WARM : 0

// 칸 하나의 불 모습
export const fireLookOf = (fire: FireScene, p: Point): FireLook => {
  const { before, game, back, spread, boss } = fire
  const kind = fireKindAt(game.stage, p)
  if (!kind) return NO_FIRE

  if (kind === 'spark') {
    const was = has(before.sparks, p) ? 0 : 1
    const now = has(game.sparks, p) ? 0 : 1
    return {
      ...NO_FIRE,
      kind,
      boss,
      lit: fire.dropping ? was * (1 - back) : was === now ? now : spread,
    }
  }

  const heatBefore = heatOf(before, fire.warmBefore, p)
  if (fire.dropping) {
    const ash = has(before.ashes, p) ? 1 - back : 0
    return { ...NO_FIRE, kind, boss, heat: heatBefore * (1 - back), stand: 1 - ash, mark: ash }
  }
  if (has(fire.ashed, p)) {
    const crumble = clamp01((fire.elapsed - ashStart(p, fire.segments)) / FIRE.ash)
    return { ...NO_FIRE, kind, boss, heat: 1, crumble, mark: smooth(crumble) }
  }
  if (has(game.ashes, p)) return { ...NO_FIRE, kind, boss, stand: 0, mark: 1 }
  if (has(fire.blocked, p)) {
    const u = clamp01((fire.elapsed - fire.blockedStart) / FIRE.smother)
    return {
      ...NO_FIRE,
      kind,
      boss,
      heat: blockedHeat(u, fire.ashed.length > 0 ? WARM : heatBefore),
    }
  }
  const delay = fire.chain.find((c) => same(c.at, p))?.delay
  return {
    ...NO_FIRE,
    kind,
    boss,
    heat: lerp(
      heatBefore,
      heatOf(game, fire.warmAfter, p),
      has(fire.trailCaught, p)
        ? fire.trailSpread
        : delay !== undefined
          ? clamp01((fire.elapsed - fire.kindleStart - delay) / FIRE.kindle)
          : spread,
    ),
  }
}
