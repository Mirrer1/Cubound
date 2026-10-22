import {
  BAR,
  BAR_HEIGHT,
  type BarPiece,
  type BarPose,
  type CubeRoll,
  barPieces,
  footprintCells,
  frontCell,
} from '../view'
import { type Chain, clamp01, easeIn, lerp, moveEase, smooth } from './curveFrame'
import { FIRE } from './fireFrame'
import { type KegScene, kegDrop } from './kegFrame'
import {
  SECONDS,
  type Segment,
  cellsOf,
  has,
  playerPath,
  same,
  secondsOf,
  segmentsOf,
  totalSeconds,
} from './pathFrame'
import { restartDrop, restartDuration } from './restartFrame'
import { TILE } from '@/game/iso'
import { barCells, isBridge, standHeight } from '@/game/rules'
import type { Bar, Direction, GameEvent, GameState, Point } from '@/game/types'

// 달군 쇠의 숯불빛이 스미는 초와 한 칸 늘어나는 초
export const FORGE = { heat: 0.14, grow: 0.36 }

// 아래층으로 떨어지는 밀기 초
const FELL = SECONDS.fell

// 옆을 밀어 90도 도는 초, 따라 들어가는 큐브도 같은 길이
export const TURN_SECONDS = 0.34

// 세 칸 막대가 도는 초, 끝이 더 멀리 도는 몫
const LONG_TURN_SECONDS = 0.45

const turnSeconds = (bar: Bar) => (bar.length > 2 ? LONG_TURN_SECONDS : TURN_SECONDS)

// 막혀서 끝이 밀렸다 돌아오는 각
const NUDGE = (5 * Math.PI) / 180

// 큐브가 다리 위에 있는 동안 막대와 큐브가 함께 가라앉는 px
const DIP = 1.5

// 재시작에 처음 자리로 돌아오는 초
const RESTORE = 0.24

const ANGLE: Record<Direction, number> = {
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
  up: -Math.PI / 2,
}

const OFFSET: Record<Direction, Point> = {
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  up: { x: 0, y: -1 },
}

type Pushed = Extract<GameEvent, { type: 'barPushed' }>

// 밑이 구덩이인 칸은 -1
const groundOf = (state: GameState, p: Point) =>
  isBridge(state, { ...p, dir: 'right', length: 1, level: 0, heat: null })
    ? -1
    : standHeight(state, p)

// 받치는 칸이 한쪽 끝에 몰리고 나머지가 떠 있으면 떠 있는 쪽 처짐
const sagOf = (supported: boolean[]): BarPose['sag'] => {
  const n = supported.length
  const firstGap = supported.indexOf(false)
  const lastHeld = supported.lastIndexOf(true)
  if (firstGap < 0 || lastHeld < 0) return null
  if (firstGap > 0 && supported.slice(firstGap).every((s) => !s)) {
    return { at: firstGap - (n - 1) / 2 - 0.5, angle: BAR.sag }
  }
  const firstHeld = supported.indexOf(true)
  if (supported.slice(firstHeld).every((s) => s)) {
    return { at: firstHeld - (n - 1) / 2 - 0.5, angle: -BAR.sag }
  }
  return null
}

// 떠 있는 쪽 밑에 땅이 있으면 받침 끝이 그 땅에 닿는 각, 모두 구덩이면 정한 처짐 각
const touchSag = (
  sag: BarPose['sag'],
  grounds: number[],
  level: number,
  length: number,
): BarPose['sag'] => {
  if (!sag || grounds.length === 0) return sag
  const drop = (level - Math.max(...grounds)) * TILE.layer
  const tip = Math.abs((sag.angle > 0 ? length / 2 : -length / 2) - sag.at) * TILE.height
  const angle = Math.max(BAR.sag, Math.asin(Math.min(1, drop / tip)))
  return { ...sag, angle: Math.sign(sag.angle) * angle }
}

// 멈춰 있는 막대 모습
export const restPose = (state: GameState, bar: Bar): BarPose => {
  const cells = barCells(bar)
  const n = cells.length
  const bridge = isBridge(state, bar)
  const length = bridge ? n : n - 1 + BAR.reach * 2
  const below = cells.map((c) => groundOf(state, c))
  const hanging = below.filter((g) => g < bar.level && g >= 0)
  return {
    x: (cells[0].x + cells[n - 1].x) / 2,
    y: (cells[0].y + cells[n - 1].y) / 2,
    angle: ANGLE[bar.dir],
    length,
    span: n - 1,
    inset: bridge ? 0 : BAR.body.inset,
    z: bar.level * TILE.layer - (bridge ? BAR_HEIGHT : 0),
    sag: bridge
      ? null
      : touchSag(sagOf(below.map((g) => g >= bar.level)), hanging, bar.level, length),
    lips: 0,
  }
}

// 처짐이 바뀌는 동안, 반대쪽으로 바뀌면 가운데에서 수평
const blendSag = (a: BarPose['sag'], b: BarPose['sag'], p: number): BarPose['sag'] => {
  if (a && b && Math.sign(a.angle) === Math.sign(b.angle)) {
    return { at: lerp(a.at, b.at, p), angle: lerp(a.angle, b.angle, p) }
  }
  if (a && b) {
    return p < 0.5 ? { ...a, angle: a.angle * (1 - 2 * p) } : { ...b, angle: b.angle * (2 * p - 1) }
  }
  const one = a ?? b
  const k = a ? 1 - p : p
  return one && k > 0 ? { ...one, angle: one.angle * k } : null
}

const blendPose = (a: BarPose, b: BarPose, p: number, z = p): BarPose => ({
  x: lerp(a.x, b.x, p),
  y: lerp(a.y, b.y, p),
  angle: lerp(a.angle, b.angle, p),
  length: lerp(a.length, b.length, p),
  span: lerp(a.span, b.span, p),
  inset: lerp(a.inset, b.inset, p),
  z: lerp(a.z, b.z, z),
  sag: blendSag(a.sag, b.sag, p),
  lips: lerp(a.lips, b.lips, p),
})

// 축 칸을 중심으로 각 da만큼 돈 모습
const turned = (pose: BarPose, pivot: Point, da: number): BarPose => {
  const c = Math.cos(da)
  const s = Math.sin(da)
  const dx = pose.x - pivot.x
  const dy = pose.y - pivot.y
  return {
    ...pose,
    x: pivot.x + dx * c - dy * s,
    y: pivot.y + dx * s + dy * c,
    angle: pose.angle + da,
  }
}

const turnOf = (from: number, to: number) => {
  const d = ((((to - from) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
  return d
}

// 밀린 막대가 걸리는 초
const pushSeconds = (e: Pushed) =>
  e.to.level < e.from.level ? FELL : e.pivot ? turnSeconds(e.from) : SECONDS.pushed

// 낮은 땅에 닿게 기우는 막대, 밀기 30%부터 밀리는 내내 기울고 밀기 뒤 짧게 마저 내려앉는 시간
const TIP = { from: 0.3, tail: 0.15 }

// 다리가 되는 막대가 밀림을 마친 뒤 구덩이로 내려앉는 초, 밀리는 동안 땅 위 끝이 땅에 묻히지 않는 차례
export const SINK_SECONDS = 0.12

const sinkEnd = (e: Pushed) => (e.bridge ? pushSeconds(e) + SINK_SECONDS : 0)

const tipEnd = (e: Pushed) => (e.tip ? pushSeconds(e) + (e.pivot ? 0 : TIP.tail) : 0)

// 밀림과 이어지는 기우는 진행도
const tipProgress = (e: Pushed, elapsed: number) => {
  const start = pushSeconds(e) * TIP.from
  return smooth(clamp01((elapsed - start) / (tipEnd(e) - start)))
}

// 밀리는 막대 모습, 다리로 내려앉는 몫은 sink, 떨어지는 몫은 끝에서 가속
const pushPose = (
  before: GameState,
  game: GameState,
  e: Pushed,
  p: number,
  sink: number,
): BarPose => {
  const from = restPose(before, e.from)
  const to = restPose(game, e.to)
  const bridged = to.inset < from.inset
  const z =
    to.z < from.z
      ? bridged
        ? sink
        : p < 0.6
          ? 0
          : easeIn((p - 0.6) / 0.4)
      : smooth(clamp01(p / 0.5))
  // 다리로 내려앉는 막대의 양 끝이 가장자리에 얹히는 몫, 밀기 45%부터
  const reach = bridged ? smooth(clamp01((p - 0.45) / 0.55)) : p
  const shape = {
    ...blendPose(from, to, reach, z),
    inset: lerp(from.inset, to.inset, bridged ? sink : reach),
    sag: blendSag(from.sag, to.sag, p),
  }
  if (!e.pivot) return { ...shape, x: lerp(from.x, to.x, p), y: lerp(from.y, to.y, p) }

  const da = turnOf(from.angle, to.angle)
  const spun = turned(from, e.pivot, da * p)
  const pose = { ...shape, x: spun.x, y: spun.y, angle: spun.angle }
  const cos = Math.cos(pose.angle)
  const sin = Math.sin(pose.angle)
  const side = Math.sign((e.pivot.x - pose.x) * cos + (e.pivot.y - pose.y) * sin)
  // 축 칸 가운데에서 0.3칸, 축 쪽 조각이 축 칸 밖으로 나가지 않는 자리
  const cut = side * (pose.span / 2 - 0.3)
  const mid = (cut - side * (pose.length / 2)) / 2
  const swing = {
    ...pose,
    x: pose.x + mid * cos,
    y: pose.y + mid * sin,
    length: 2 * Math.abs(mid - cut),
  }
  // 축 칸을 뺀 도는 끝 칸, 축 칸이 앞이어도 끝이 큐브를 덮지 않는 차례
  const { pivot } = e
  const away = footprintCells(swing).filter((c) => !same(c, pivot))
  const front = frontCell(away.length > 0 ? away : [pivot])
  return { ...pose, turn: { cut, side, pivot, front } }
}

// 큐브가 민 막대가 불에 닿기까지의 초, 내 이동이 다 끝난 뒤
export const forgeStart = (events: GameEvent[]) => {
  const at = events.findIndex((e) => e.type === 'barHeated' || e.type === 'barStretched')
  if (at < 0) return null
  const before = events.slice(0, at)
  const own = totalSeconds(segmentsOf(playerPath(before)))
  const pushed = before.find((e): e is Pushed => e.type === 'barPushed')
  const kindled = before.some((e) => e.type === 'kindled')
  return Math.max(own + (kindled ? FIRE.kindle : 0), pushed ? pushSeconds(pushed) : 0)
}

// 밀린 막대가 칸에 닿는 초와 떠나는 초, 닿음은 밀림이 끝나는 때, 떠남은 밀림이 시작하는 때
export const barTouchAt = (events: GameEvent[], p: Point) => {
  let arrive: number | null = null
  let leave: number | null = null
  for (const e of events) {
    if (e.type !== 'barPushed') continue
    const was = has(barCells(e.from), p)
    const now = has(barCells(e.to), p)
    // 낮은 땅에 닿게 기우는 수는 밀림이 끝난 때와 끝이 땅에 닿는 때의 가운데
    if (now && !was) arrive = e.tip ? (pushSeconds(e) + tipEnd(e)) / 2 : pushSeconds(e)
    if (was && !now) leave = 0
  }
  return { arrive, leave }
}

// 도는 막대를 따라 들어가는 큐브 구간
export const turnSegments = (events: GameEvent[], segments: Segment[]): Segment[] => {
  const turn = events.find((e): e is Pushed => e.type === 'barPushed' && e.pivot !== null)
  return turn && segments[0]?.event.type === 'moved'
    ? [{ ...segments[0], seconds: turnSeconds(turn.from) }, ...segments.slice(1)]
    : segments
}

// 막대 연출이 끝나는 초, 이동 몫보다 늦게 끝나는 몫만
export const barEnd = (events: GameEvent[]) => {
  const start = forgeStart(events)
  return Math.max(
    0,
    ...events.map((e) =>
      e.type === 'barPushed' ? Math.max(pushSeconds(e), tipEnd(e), sinkEnd(e)) : 0,
    ),
    start === null ? 0 : start + FORGE.heat + FORGE.grow,
  )
}

const shoveAt = (events: GameEvent[], subject: 'player' | 'box') => {
  const at = events.findIndex((e) => e.type === 'barStretched' && e.shoved?.subject === subject)
  const start = forgeStart(events)
  return at < 0 || start === null ? null : { at, from: start + FORGE.heat }
}

// 늘어나는 막대에 밀려나는 큐브의 길, 늘어나기를 기다린 뒤 늘어남과 같은 빠르기
export const shoveSegments = (events: GameEvent[], own: Segment[]): Segment[] => {
  const shove = shoveAt(events, 'player')
  if (!shove) return own

  const mine = segmentsOf(playerPath(events.slice(0, shove.at)))
  const path = playerPath(events.slice(shove.at))
  if (path.length === 0) return own
  const hold = mine.at(-1)?.event.to ?? path[0].from
  return [
    ...mine,
    {
      event: { type: 'moved', from: hold, to: hold },
      seconds: Math.max(0, shove.from - totalSeconds(mine)),
      wait: true,
    },
    ...path.map((event) => ({
      event,
      seconds: event.type === 'moved' && cellsOf(event) === 1 ? FORGE.grow : secondsOf(event),
    })),
  ]
}

// 늘어나는 막대에 밀려나는 상자의 시계, 늘어나기 전에는 0이고 늘어남과 같이 끝나는 빠르기
export const shoveClock = (events: GameEvent[], elapsed: number) => {
  const shove = shoveAt(events, 'box')
  return shove ? Math.max(0, ((elapsed - shove.from) * SECONDS.pushed) / FORGE.grow) : elapsed
}

export interface BarDraw {
  pieces: BarPiece[]
  opacity: number
  heat: number // 숯불빛이 스민 정도
  waiting: boolean // 달궈진 채 늘어날 자리를 기다리는 막대
}

interface BarView {
  before: GameState
  game: GameState
  events: GameEvent[]
  prevEvents: GameEvent[]
  moving: boolean
  dropping: boolean
  t: number
  elapsed: number // 이동이 시작한 뒤로 흐른 초
  chain: Chain
  ashed: Point[] // 이 수에 재가 되는 숯
  keg: KegScene
  stepT: number
  ride: (p: Point) => number // 그 칸 발판이 오르내리는 진행도
  cube: { x: number; y: number }
  sinkAt?: (x: number, y: number) => number // 무너지는 칸이 내려앉은 화면 거리
}

// 양 끝 칸이 내려앉은 만큼 낮추고 더 꺼진 끝으로 기운 모습, 이미 처진 막대와 다리 제외
// 축은 덜 꺼진 끝 칸의 안쪽 경계, 꺼진 끝 칸 가운데가 그 깊이만큼 내려가는 각
// 막대 꼬리와 머리 칸이 내려앉은 화면 거리
const endSinks = (pose: BarPose, sinkAt: (x: number, y: number) => number) => {
  const half = pose.span / 2
  const dx = half * Math.cos(pose.angle)
  const dy = half * Math.sin(pose.angle)
  return [sinkAt(pose.x - dx, pose.y - dy), sinkAt(pose.x + dx, pose.y + dy)]
}

const onCrack = (pose: BarPose, sinkAt: (x: number, y: number) => number) =>
  endSinks(pose, sinkAt).some((s) => s > 0.01)

// 밀리는 동안은 멈춘 자리 measure로 잰 기울기를 k만큼만, 칸 사이를 지나며 꺼진 끝이 옆 칸 바닥에 묻히지 않게
const crackTilt = (
  pose: BarPose,
  sinkAt: (x: number, y: number) => number,
  measure = pose,
  k = 1,
): BarPose => {
  if (pose.inset === 0 || pose.span === 0 || k <= 0) return pose
  const half = pose.span / 2
  const [tail, head] = endSinks(measure, sinkAt)
  const diff = head - tail
  const lowered = { ...pose, z: pose.z - Math.min(tail, head) * k }
  if (Math.abs(diff) < 0.01) return lowered
  const reach = pose.span - 0.5
  const angle = Math.atan2(diff, reach * TILE.height) * k
  const at = diff > 0 ? 0.5 - half : half - 0.5
  const pit = pose.sag
  if (!pit) return { ...lowered, sag: { at, angle } }
  // 구덩이 처짐이 함께 있으면 두 기울기를 더하고 축은 각의 크기로 나눈 자리
  if (Math.sign(pit.angle) !== Math.sign(angle)) {
    return Math.abs(pit.angle) >= Math.abs(angle) ? lowered : { ...lowered, sag: { at, angle } }
  }
  const sum = pit.angle + angle
  const shade = { at: pit.at, angle: pit.angle }
  return { ...lowered, sag: { at: (pit.at * pit.angle + at * angle) / sum, angle: sum, shade } }
}

// 밀리는 막대의 기울기가 앞 자리에서 풀리고 새 자리에서 생기는 구간, 끝 칸 가운데가 경계를 넘는 절반에 수평
const TILT_EDGE = 0.5

const stretchedIn = (events: GameEvent[], index: number) =>
  events.some((e) => e.type === 'barStretched' && e.bar === index)

// 큐브가 올라선 다리와 가라앉은 px, 옆 칸에서 다리 칸까지 한 칸 동안 서서히 바뀌는 깊이
const wobbleOf = (game: GameState, cube: Point) => {
  for (const bar of game.bars) {
    if (!isBridge(game, bar)) continue
    const d = Math.min(...barCells(bar).map((c) => Math.abs(cube.x - c.x) + Math.abs(cube.y - c.y)))
    const on = smooth(clamp01(1 - d))
    if (on > 0) return { bar, dip: DIP * on }
  }
  return null
}

// 막혀서 못 돈 막대 끝이 밀렸다 돌아오는 각과 축
const nudgeOf = (before: GameState, events: GameEvent[], index: number, elapsed: number) => {
  const blocked = events.find((e) => e.type === 'blocked')
  if (blocked?.type !== 'blocked') return null
  const bar = before.bars[index]
  const cells = barCells(bar)
  const d = OFFSET[blocked.direction]
  const hit = { x: before.player.x + d.x, y: before.player.y + d.y }
  const axis = OFFSET[bar.dir]
  if (axis.x * d.x + axis.y * d.y !== 0) return null
  const head = same(hit, cells[cells.length - 1])
  if (!head && !same(hit, cells[0])) return null
  const arm = head ? axis : { x: -axis.x, y: -axis.y }
  const sign = Math.sign(arm.x * d.y - arm.y * d.x)
  const q = clamp01(elapsed / SECONDS.blocked)
  return {
    pivot: head ? cells[0] : cells[cells.length - 1],
    angle: sign * NUDGE * Math.sin(Math.PI * q),
  }
}

// 밑 칸이 바뀌어 달라지는 모습의 진행도, 폭발로 깎이면 깎이는 칸, 숯이 타면 무너지는 숯, 그 밖은 이동 몫
const settleProgress = (view: BarView, cells: Point[]) => {
  const dropped = Math.max(0, ...cells.map((c) => kegDrop(view.keg, c)))
  if (view.keg.blasts.some((b) => cells.some((c) => has(b.lowered, c)))) return clamp01(dropped)
  if (cells.some((c) => has(view.ashed, c))) return smooth(clamp01(view.elapsed / FIRE.ash))
  const lift = cells.find((c) =>
    view.game.stage.entities.some((e) => e.type === 'lift' && same(e, c)),
  )
  return lift ? view.ride(lift) : view.stepT
}

// 그 순간 판 전체의 막대 모습과 다리 위 큐브 흔들림
export const barScene = (view: BarView) => {
  const { before, game, events, prevEvents, moving, dropping, t, elapsed, chain, cube } = view
  if (game.bars.length === 0) return { draws: [] as BarDraw[], roll: null as CubeRoll | null }

  if (dropping) {
    // 반투명한 동안 조각 이음매가 비치지 않는 한 덩이
    const whole = (pose: BarPose): BarPose => ({ ...pose, hold: frontCell(footprintCells(pose)) })
    const back = smooth(
      clamp01((t * restartDuration(game.boxes.length, game.stones.length)) / RESTORE),
    )
    // 옮겨진 막대만 마지막 상자와 같은 차례로 처음 자리 위에서 내려앉는 재시작
    const drop = restartDrop(t, game.boxes.length, game.boxes.length, game.stones.length)
    const draws = game.bars.flatMap((bar, i): BarDraw[] => {
      const now = restPose(game, bar)
      const was = before.bars[i] ? restPose(before, before.bars[i]) : null
      const moved = was !== null && JSON.stringify(was) !== JSON.stringify(now)
      const touched = was === null || moved
      return [
        ...(was && moved
          ? [
              {
                pieces: barPieces(whole(was)),
                opacity: 1 - clamp01(back / 0.6),
                heat: 0,
                waiting: false,
              },
            ]
          : []),
        {
          pieces: barPieces(touched ? whole({ ...now, z: now.z + drop.lift * TILE.layer }) : now),
          opacity: touched ? drop.opacity : 1,
          heat: 0,
          waiting: false,
        },
      ]
    })
    return { draws, roll: null }
  }

  const wobble = wobbleOf(game, cube)
  const start = moving ? forgeStart(events) : null
  const draws = game.bars.map((bar, i): BarDraw => {
    const was = moving ? before.bars[i] : bar
    const pushed = moving
      ? events.find((e): e is Pushed => e.type === 'barPushed' && e.bar === i)
      : undefined
    const stretched = moving && stretchedIn(events, i)
    const heated = moving && events.some((e) => e.type === 'barHeated' && e.bar === i)
    const final = restPose(game, bar)

    let pose: BarPose
    const push = pushed ? moveEase(clamp01(elapsed / pushSeconds(pushed)), chain) : 0
    if (pushed) {
      const sink = smooth(clamp01((elapsed - pushSeconds(pushed)) / SINK_SECONDS))
      pose = pushPose(before, game, pushed, push, sink)
      if (pushed.tip) {
        const final = restPose(game, pushed.to)
        // 도는 막대는 무너지는 칸 기울기가 풀리는 곡선과 같은 곡선, 합친 기울기가 한 방향으로만 바뀜
        const q = pushed.pivot ? smooth(push) : tipProgress(pushed, elapsed)
        const sag = blendSag(restPose(before, pushed.from).sag, final.sag, q)
        // 곧게 밀리는 막대의 처짐 축은 땅 모서리에 고정, 모서리를 넘어간 몫만 처짐
        const edge =
          sag && final.sag && !pushed.pivot
            ? final.sag.at +
              (final.x - pose.x) * Math.cos(pose.angle) +
              (final.y - pose.y) * Math.sin(pose.angle)
            : null
        pose = { ...pose, sag: sag && edge !== null ? { ...sag, at: edge } : sag }
      }
    } else if (!moving) {
      pose = final
    } else {
      pose = restPose(before, was)
    }
    if (stretched && start !== null) {
      const grow = smooth(clamp01((elapsed - start - FORGE.heat) / FORGE.grow))
      pose = blendPose(pose, final, grow)
      // 늘어나는 동안 칸 경계 이음매가 비치지 않는 한 덩이
      if (grow > 0 && grow < 1) pose = { ...pose, hold: frontCell(footprintCells(pose)) }
    } else if (moving && !pushed) {
      const q = settleProgress(view, [...barCells(was), ...barCells(bar)])
      pose = blendPose(pose, final, q)
    }

    const nudge = moving && !pushed ? nudgeOf(before, events, i, elapsed) : null
    if (nudge) pose = turned(pose, nudge.pivot, nudge.angle)
    if (wobble && wobble.bar === bar) pose = { ...pose, z: pose.z - wobble.dip, dip: wobble.dip }
    if (view.sinkAt && pushed) {
      const fromRest = restPose(before, pushed.from)
      const toRest = restPose(game, pushed.to)
      const fromOn = onCrack(fromRest, view.sinkAt)
      const toOn = onCrack(toRest, view.sinkAt)
      // 도는 막대는 도는 내내 기울기가 바뀜, 앞뒤 자리가 다 기울면 반씩
      const edge = !pushed.pivot || (fromOn && toOn) ? TILT_EDGE : 1
      const out = 1 - smooth(clamp01(push / edge))
      const into = smooth(clamp01((push - 1 + edge) / edge))
      pose =
        fromOn && (out > 0 || !toOn)
          ? crackTilt(pose, view.sinkAt, fromRest, out)
          : crackTilt(pose, view.sinkAt, toRest, into)
    } else if (view.sinkAt) {
      pose = crackTilt(pose, view.sinkAt)
    }

    // 늘어난 수 끝에도 남는 달궈짐, 다음 수 동안 식는 빛
    const heat = heated
      ? smooth(clamp01((elapsed - (start ?? 0)) / FORGE.heat))
      : stretched || was.heat !== null || (!moving && stretchedIn(events, i))
        ? 1
        : moving && stretchedIn(prevEvents, i)
          ? 1 - smooth(t)
          : 0
    // 크게 기운 막대는 칸 조각 이음매가 벌어져 비치니 한 덩이
    const tilted = pose.sag && !pose.turn && !pose.hold && Math.abs(pose.sag.angle) > BAR.sag + 0.01
    if (tilted) pose = { ...pose, hold: frontCell(footprintCells(pose)) }
    return { pieces: barPieces(pose), opacity: 1, heat, waiting: bar.heat !== null }
  })

  const center = wobble && restPose(game, wobble.bar)
  const roll: CubeRoll | null = wobble &&
    center && {
      x: center.x,
      y: center.y,
      axis: ANGLE[wobble.bar.dir],
      z: wobble.bar.level * TILE.layer - BAR_HEIGHT / 2,
      angle: 0,
      dip: wobble.dip,
    }
  return { draws, roll }
}

export type BarScene = ReturnType<typeof barScene>

// 칸 하나에 그릴 막대 조각
type BarDrawPiece = { piece: BarPiece; opacity: number; heat: number; waiting: boolean }

const pieceMemo = new WeakMap<
  BarScene,
  { bars: Map<string, BarDrawPiece[]>; lips: Map<string, BarDrawPiece[]> }
>()

const NO_PIECES: BarDrawPiece[] = []

const isLip = ({ kind }: { kind: string }) => kind === 'lip' || kind === 'lipSheen'

// 칸마다 나눈 막대 조각, 땅에 얹힌 다리 끝은 그 칸 물건 밑에 그리는 따로 묶음
const piecesOf = (scene: BarScene) => {
  const known = pieceMemo.get(scene)
  if (known) return known
  const bars = new Map<string, BarDrawPiece[]>()
  const lips = new Map<string, BarDrawPiece[]>()
  const add = (map: Map<string, BarDrawPiece[]>, key: string, item: BarDrawPiece) =>
    map.set(key, [...(map.get(key) ?? []), item])
  for (const draw of scene.draws)
    for (const piece of draw.pieces) {
      const key = `${piece.cell.x},${piece.cell.y}`
      const look = { opacity: draw.opacity, heat: draw.heat, waiting: draw.waiting }
      const lipFlats = piece.flats.filter(isLip)
      add(bars, key, { ...look, piece: { ...piece, flats: piece.flats.filter((f) => !isLip(f)) } })
      if (lipFlats.length > 0)
        add(lips, key, { ...look, piece: { ...piece, flats: lipFlats, faces: [], pool: null } })
    }
  const made = { bars, lips }
  pieceMemo.set(scene, made)
  return made
}

export const barsAt = (scene: BarScene, p: Point): BarDrawPiece[] =>
  piecesOf(scene).bars.get(`${p.x},${p.y}`) ?? NO_PIECES

export const lipsAt = (scene: BarScene, p: Point): BarDrawPiece[] =>
  piecesOf(scene).lips.get(`${p.x},${p.y}`) ?? NO_PIECES

// 막대 조각이 걸친 칸, 구덩이 칸도 그리는 자리가 필요한 탓
export const barKeys = (scene: BarScene) =>
  [...new Set(scene.draws.flatMap((d) => d.pieces.map((p) => `${p.cell.x}-${p.cell.y}`)))]
    .sort()
    .join(' ')
