import { clamp01, lerp, smooth } from './curveFrame'
import { type Segment, has, same, totalSeconds } from './pathFrame'
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

// 덮인 숯이 오르기 시작하는 초, 옆 불이 가장 먼저 부서지기 시작하는 때
const smotherStart = (events: GameEvent[], segments: Segment[]) =>
  Math.min(...ashedOf(events).map((p) => ashStart(p, segments)))

// 불이 끝나는 초, 켜는 수는 큐브가 닿은 뒤 켜짐 시간
export const fireEnd = (events: GameEvent[], segments: Segment[], tail: number) =>
  Math.max(
    0,
    ...ashedOf(events).map((p) => ashStart(p, segments) + FIRE.ash),
    smotheredOf(events).length > 0 ? smotherStart(events, segments) + FIRE.smother : 0,
    events.some((e) => e.type === 'kindled') ? totalSeconds(segments) + tail + FIRE.kindle : 0,
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
  return {
    before,
    game,
    dropping,
    elapsed,
    segments,
    boss: game.stage.rules?.chase === true,
    // 재시작하며 처음 모습으로 돌아가는 진행도
    back: dropping ? smooth(clamp01(t)) : 1,
    // 번짐 진행도, 켜는 수는 큐브가 닿은 뒤
    spread: !moving
      ? 1
      : kindled
        ? clamp01((elapsed - totalSeconds(segments) - tail) / FIRE.kindle)
        : stepT,
    ashed: moving && !dropping ? ashedOf(events) : [],
    // 옆 불이 꺼지는 수에 불붙음까지 올랐다 천천히 꺼지는 덮인 숯
    blocked: moving && !dropping ? smotheredOf(events) : [],
    blockedStart: smotheredOf(events).length > 0 ? smotherStart(events, segments) : 0,
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

const blockedHeat = (u: number) =>
  u < BLOCKED_RISE
    ? lerp(WARM, 1, smooth(u / BLOCKED_RISE))
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
    return { ...NO_FIRE, kind, boss, heat: blockedHeat(u) }
  }
  return {
    ...NO_FIRE,
    kind,
    boss,
    heat: lerp(heatBefore, heatOf(game, fire.warmAfter, p), spread),
  }
}
