import { type Chain, clamp01, easeIn, easeOut, lerp, smooth } from './curveFrame'
import {
  type PathEvent,
  SECONDS,
  type Segment,
  WARP,
  WIND,
  cellsOf,
  has,
  playerPath,
  same,
  secondsOf,
  segmentsOf,
  stepAt,
  totalSeconds,
} from './pathFrame'
import { restartDrop, restartDuration } from './restartFrame'
import { standHeight } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

// 시안의 0.4초 폭발 단계를 늘린 배수, 그림 단계 초는 시안 기준
const PACE = 1.75

// 한 통이 터지는 단계 초, 불 닿음 0에서 부풂, 터짐, 다 내려앉음, 끝, 연쇄 간격
export const KEG = {
  swell: 0.11 * PACE,
  flash: 0.16 * PACE,
  settle: 0.28 * PACE,
  end: 0.4 * PACE,
  chain: 0.15,
}

// 심지에 불이 붙어 끝이 달아오르는 초
const KINDLE = 0.2

// 깎인 칸이 내려앉기 시작하는 때와 걸리는 초, 터짐 직전부터
const DROP = { from: 0.12 * PACE, span: 0.16 * PACE }

// 재시작에 깎인 층이 돌아오는 초
const RESTORE = 0.24

// 부풂 배율, 터지며 사라질 때 배율, 부풂에서 달아오른 정도
const SWELL = { peak: 1.07, gone: 1.1, heat: 0.88 }

// 재 자국이 차오르기 시작하는 때, 통이 사라지는 동안의 가운데
const MARK_FROM = (KEG.swell + KEG.flash) / 2

// 불 붙은 큐브가 기울어 화약통에 닿는 때
const TOUCH = SECONDS.torched / 2

// 상자 밀기와 같은 시간 몫인 화약통이 밀려 가는 길
export const kegPath = (events: GameEvent[]) =>
  events.flatMap((e): PathEvent[] =>
    e.type === 'kegPushed'
      ? [{ type: 'pushed', from: e.from, to: e.to, result: e.result }]
      : e.type === 'slid' && e.subject === 'keg'
        ? [e]
        : [],
  )

type Exploded = Extract<GameEvent, { type: 'exploded' }>

const explodedOf = (events: GameEvent[]) =>
  events.filter((e): e is Exploded => e.type === 'exploded')

const near = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1

// 터지기 시작하는 초, move는 이동 몫 시간
export const kegStart = (events: GameEvent[], move: number) =>
  events.some((e) => e.type === 'torchedKeg')
    ? TOUCH
    : Math.max(move, totalSeconds(segmentsOf(kegPath(events))))

// 큐브를 미는 화약통이 터지는 순간, player는 밀리기 전 자리, 폭발에 안 닿은 수는 null
export const blastAt = (events: GameEvent[], move: number, player: Point | null) => {
  const blasts = explodedOf(events)
  const pushed = events.find((e) => e.type === 'blasted')
  const from = pushed?.type === 'blasted' ? pushed.from : player
  if (!events.some((e) => e.type === 'blasted' || e.type === 'blastBraced')) return null
  // 자리를 모르는 버팀은 가장 늦은 화약통 기준
  const index = from ? blasts.findIndex((e) => near(e.at, from)) : blasts.length - 1
  return kegStart(events, move) + Math.max(0, index) * KEG.chain + KEG.flash
}

// 폭발에 밀려 간 길, 한 칸은 바람 미끄러짐 몫
const blastPath = (events: GameEvent[]): Segment[] => {
  const at = events.findIndex((e) => e.type === 'blasted')
  if (at < 0) return []
  return playerPath(events.slice(at + 1)).map((event) => ({
    event,
    seconds: event.type === 'moved' && cellsOf(event) === 1 ? WIND.slide : secondsOf(event),
  }))
}

// 내 이동 뒤 터지는 순간까지 기다렸다 밀려 가는 큐브의 길, 밀려나지 않으면 own 그대로
export const blastSegments = (
  events: GameEvent[],
  own: Segment[],
  move: number,
  player: Point,
): Segment[] => {
  const path = blastPath(events)
  const at = blastAt(events, move, player)
  if (path.length === 0 || at === null) return own

  const hold = own.at(-1)?.event.to ?? path[0].event.from
  return [
    ...own,
    {
      event: { type: 'moved', from: hold, to: hold },
      seconds: Math.max(0, at - totalSeconds(own)),
      wait: true,
    },
    ...path,
  ]
}

// 밀려 간 끝에서 짝 칸으로 가는 수
export const blastWarps = (events: GameEvent[]) => {
  const at = events.findIndex((e) => e.type === 'blasted')
  return at >= 0 && events.slice(at).some((e) => e.type === 'warped')
}

// 밀려나거나 버티는 동안 기운 몫 0~1, 그 밖은 null
export const blastLean = (events: GameEvent[], move: number, player: Point, elapsed: number) => {
  const at = blastAt(events, move, player)
  if (at === null) return null
  const span = events.some((e) => e.type === 'blastBraced')
    ? WIND.brace
    : totalSeconds(blastPath(events))
  if (elapsed < at || elapsed >= at + span || span <= 0) return null
  return Math.sin(Math.PI * clamp01((elapsed - at) / span))
}

// 화약통 연출이 끝나는 초, 이동 몫보다 늦게 끝나는 몫만
export const kegEnd = (events: GameEvent[], move: number) => {
  const start = kegStart(events, move)
  const blasts = explodedOf(events)
  const at = blastAt(events, move, null)
  const pushedEnd = totalSeconds(segmentsOf(kegPath(events)))
  return Math.max(
    pushedEnd,
    events.some((e) => e.type === 'fuseLit') ? start + KINDLE : 0,
    blasts.length > 0 ? start + (blasts.length - 1) * KEG.chain + KEG.end : 0,
    at === null
      ? 0
      : at +
          (events.some((e) => e.type === 'blastBraced')
            ? WIND.brace
            : totalSeconds(blastPath(events)) + (blastWarps(events) ? WARP.sink + WARP.rise : 0)),
    // 밀려난 큐브가 떠난 칸이 다 내려앉는 때
    at !== null && events.some((e) => e.type === 'blasted') ? at + WIND.slide / 2 + DROP.span : 0,
  )
}

interface KegView {
  before: GameState
  game: GameState
  events: GameEvent[]
  moving: boolean
  dropping: boolean
  t: number
  elapsed: number // 이동이 시작한 뒤로 흐른 초
  move: number // 이동 몫 초
  stepT: number
}

// 그 순간 판 전체의 화약통 값
export const kegScene = ({
  before,
  game,
  events,
  moving,
  dropping,
  t,
  elapsed,
  move,
  stepT,
}: KegView) => {
  const live = moving && !dropping
  const start = kegStart(events, move)
  const pushed = events.find((e) => e.type === 'blasted')
  const cubeAt = blastAt(events, move, before.player)
  return {
    before,
    game,
    events: live ? events : [],
    dropping,
    elapsed: live ? elapsed : Infinity,
    stepT: live ? stepT : 1,
    // 재시작에 깎인 층이 돌아온 정도
    restore: dropping
      ? smooth(clamp01((t * restartDuration(game.boxes.length, game.stones.length)) / RESTORE))
      : 1,
    t,
    start,
    blasts: live ? explodedOf(events).map((e, i) => ({ ...e, from: start + i * KEG.chain })) : [],
    // 밀려나는 큐브가 떠난 칸, 큐브가 반쯤 간 뒤 내려앉는 칸
    left:
      live && pushed?.type === 'blasted' && cubeAt !== null
        ? { p: pushed.from, from: cubeAt + WIND.slide / 2 }
        : null,
    path: live ? kegPath(events) : [],
  }
}

export type KegScene = ReturnType<typeof kegScene>

export interface KegLook {
  on: boolean // 칸 위에 선 화약통
  fuse: boolean // 심지 화약통
  cords: number // 남은 심지 마디, 끝 마디는 탄 만큼 소수
  ember: number // 심지 끝 불빛 진하기
  heat: number // 불이 닿아 달아오른 정도
  swell: number // 부푼 배율
  opacity: number
  lift: number // 재시작에 처음 자리 위로 뜬 층 수
  burst: number // 터지기 시작한 뒤 흐른 초, -1이면 터지지 않는 칸
  mark: number // 터진 자리 재 자국 진하기
  ashTo: number // 이 수에 탄 심지가 시작한 마디 자리, 재는 cords에서 여기까지
  ash: number // 탄 심지 재 진하기
  trail: { u: number; v: number } // 밀리는 동안 불티가 처지는 칸 쪽
}

export const NO_KEG: KegLook = {
  on: false,
  fuse: false,
  cords: 0,
  ember: 0,
  heat: 0,
  swell: 1,
  opacity: 1,
  lift: 0,
  burst: -1,
  mark: 0,
  ashTo: 0,
  ash: 0,
  trail: { u: 0, v: 0 },
}

const kegAt = (state: GameState, p: Point) => state.kegs.find((k) => same(k, p))

// 이 수에 밀려 p에 온 화약통의 떠나기 전 자리
const originOf = (path: PathEvent[], p: Point) =>
  path.length > 0 && same(path[path.length - 1].to, p) ? path[0].from : p

// 터진 자리 재 자국 진하기, 통이 사라지는 동안 차오르고 재시작에 깎인 칸과 같은 박자로 옅어짐
const markOf = (scene: KegScene, p: Point, s: number) => {
  const { before, game, dropping, restore } = scene
  if (dropping) return has(before.scorched, p) && !has(game.scorched, p) ? 1 - restore : 0
  if (s > -Infinity) return smooth(clamp01((s - MARK_FROM) / (KEG.settle - MARK_FROM)))
  return has(game.scorched, p) ? 1 : 0
}

// 칸 하나에 선 화약통 모습, 밀리는 동안의 도착 칸은 제외
export const kegLookOf = (scene: KegScene, p: Point): KegLook => {
  const { before, game, events, dropping, elapsed, stepT, path } = scene
  const blast = scene.blasts.find((e) => same(e.at, p))
  const s = blast ? elapsed - blast.from : -Infinity
  const mark = markOf(scene, p, s)
  const was = kegAt(before, originOf(path, p))
  const now = kegAt(game, p)
  if (dropping) {
    // 건드린 화약통만 마지막 상자와 같은 차례로 처음 자리 위에서 내려앉는 재시작
    const left = kegAt(before, p)
    const keg = now ?? left
    if (!keg) return { ...NO_KEG, mark }
    const look = { ...NO_KEG, on: true, fuse: keg.fuse, cords: keg.fuse ? 4 : 0, mark }
    if (!now) return { ...look, opacity: 1 - scene.restore }
    if (left && JSON.stringify(left) === JSON.stringify(now)) return look
    const { boxes, stones } = game
    const drop = restartDrop(scene.t, boxes.length, boxes.length, stones.length)
    return { ...look, opacity: drop.opacity, lift: drop.lift }
  }

  const keg = now ?? (blast ? was : undefined)
  if (!keg) return { ...NO_KEG, mark }

  const lit = was?.lit ?? 0
  const kindled = events.some((e) => e.type === 'fuseLit' && same(e.at, p))
  // 남은 수만큼의 마디, 이 수에 줄어드는 끝 마디는 이동 몫 동안 타 들어가는 길이
  const cords = !keg.fuse ? 0 : lit > 0 ? lerp(lit, now?.lit ?? 0, stepT) : 4
  const swellP = smooth(clamp01(s / KEG.swell))
  const gone = clamp01((s - KEG.swell) / (KEG.flash - KEG.swell))
  return {
    ...NO_KEG,
    on: !(
      path.length > 0 &&
      same(path[path.length - 1].to, p) &&
      elapsed < totalSeconds(segmentsOf(path))
    ),
    fuse: keg.fuse,
    cords,
    ember:
      lit > 0
        ? 1 - (cords <= 0 ? swellP : 0)
        : kindled
          ? smooth(clamp01((elapsed - scene.start) / KINDLE))
          : 0,
    heat: SWELL.heat * swellP,
    swell: lerp(1, SWELL.peak, swellP) + (SWELL.gone - SWELL.peak) * gone,
    opacity: 1 - easeIn(gone),
    burst: blast && s >= 0 && s < KEG.end ? s / PACE : -1,
    mark,
    ashTo: lit,
    ash: keg.fuse && lit > (now?.lit ?? 0) ? 1 - stepT : 0,
  }
}

export interface KegFrame {
  x: number
  y: number
  level: number
  to: Point
  event: PathEvent
  gone: number // 지금 구간에서 간 몫
  sunk: boolean // 떠난 칸 높이 아래로 내려간 동안
  look: KegLook
}

// 밀리는 화약통 자리, chain은 얼음 미끄러짐까지 담은 곡선, 다 밀렸으면 null
export const movingKeg = (scene: KegScene, chain: Chain): KegFrame | null => {
  const { before, path, elapsed } = scene
  const segments = segmentsOf(path)
  if (path.length === 0 || elapsed >= totalSeconds(segments)) return null
  const step = stepAt(segments, elapsed, chain)
  if (!step) return null

  const { event, index, p } = step
  const at = (q: Point) => standHeight(before, q)
  const fromLevel = index === 0 ? at(path[0].from) : at(event.from)
  const toLevel = event.type === 'pushed' && event.result === 'fell' ? at(event.to) : fromLevel
  const to = path[path.length - 1].to
  // 떨어지는 화약통은 상자처럼 끝에서 가속
  const level = p < 0.6 ? fromLevel : lerp(fromLevel, toLevel, easeIn((p - 0.6) / 0.4))
  return {
    x: lerp(event.from.x, event.to.x, p),
    y: lerp(event.from.y, event.to.y, p),
    level,
    to,
    event,
    gone: p,
    sunk: level < fromLevel,
    look: {
      ...kegLookOf(scene, to),
      on: true,
      trail: {
        u: (event.from.x - event.to.x) * Math.sin(Math.PI * p),
        v: (event.from.y - event.to.y) * Math.sin(Math.PI * p),
      },
    },
  }
}

// 칸이 깎여 내려앉은 층 수, 재시작에는 아직 돌아오지 않은 층 수
export const kegDrop = (scene: KegScene, p: Point) => {
  if (scene.dropping) {
    const was = scene.before.heights[p.y]?.[p.x] ?? -1
    const now = scene.game.heights[p.y][p.x]
    return was >= 0 && was < now ? (now - was) * (1 - scene.restore) : 0
  }
  return scene.blasts.reduce((sum, blast) => {
    if (!has(blast.lowered, p)) return sum
    const from = scene.left && same(scene.left.p, p) ? scene.left.from : blast.from + DROP.from
    return sum + easeOut(clamp01((scene.elapsed - from) / DROP.span))
  }, 0)
}

// 폭발로 불이 붙는 숯의 열, 화약통이 터지는 순간부터, 그 밖은 null
export const caughtHeat = (scene: KegScene, p: Point) => {
  const blast = scene.blasts.find((e) => has(e.caught, p))
  return blast
    ? smooth(clamp01((scene.elapsed - blast.from - KEG.flash) / (KEG.end - KEG.flash)))
    : null
}

// 깎인 칸의 흙먼지, 터지기 시작한 뒤 흐른 초와 화약통 반대쪽, 없으면 null
export const dustOf = (scene: KegScene, p: Point) => {
  const blast = scene.blasts.find((e) => has(e.lowered, p))
  if (!blast) return null
  const s = scene.elapsed - blast.from
  return s >= 0 && s < KEG.end ? { s: s / PACE, du: p.x - blast.at.x, dv: p.y - blast.at.y } : null
}
