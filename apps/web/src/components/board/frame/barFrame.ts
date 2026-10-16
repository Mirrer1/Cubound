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

// 멈춰 있는 막대 모습
export const restPose = (state: GameState, bar: Bar): BarPose => {
  const cells = barCells(bar)
  const n = cells.length
  const bridge = isBridge(state, bar)
  return {
    x: (cells[0].x + cells[n - 1].x) / 2,
    y: (cells[0].y + cells[n - 1].y) / 2,
    angle: ANGLE[bar.dir],
    length: bridge ? n : n - 1 + BAR.reach * 2,
    span: n - 1,
    inset: bridge ? 0 : BAR.body.inset,
    z: bar.level * TILE.layer - (bridge ? BAR_HEIGHT : 0),
    sag: bridge ? null : sagOf(cells.map((c) => groundOf(state, c) >= bar.level)),
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
  e.to.level < e.from.level ? FELL : e.pivot ? TURN_SECONDS : SECONDS.pushed

// 밀리는 막대 모습, 다리로 내려앉는 몫은 밀기 30%부터, 떨어지는 몫은 끝에서 가속
const pushPose = (before: GameState, game: GameState, e: Pushed, p: number): BarPose => {
  const from = restPose(before, e.from)
  const to = restPose(game, e.to)
  const bridged = to.inset < from.inset
  const z =
    to.z < from.z
      ? bridged
        ? smooth(clamp01((p - 0.3) / 0.7))
        : p < 0.6
          ? 0
          : easeIn((p - 0.6) / 0.4)
      : smooth(clamp01(p / 0.5))
  // 다리로 내려앉는 막대의 양 끝이 가장자리에 얹히는 몫, 밀기 45%부터
  const reach = bridged ? smooth(clamp01((p - 0.45) / 0.55)) : p
  const shape = { ...blendPose(from, to, reach, z), sag: blendSag(from.sag, to.sag, p) }
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
    if (now && !was) arrive = pushSeconds(e)
    if (was && !now) leave = 0
  }
  return { arrive, leave }
}

// 도는 막대를 따라 들어가는 큐브 구간
export const turnSegments = (events: GameEvent[], segments: Segment[]): Segment[] =>
  events.some((e) => e.type === 'barPushed' && e.pivot) && segments[0]?.event.type === 'moved'
    ? [{ ...segments[0], seconds: TURN_SECONDS }, ...segments.slice(1)]
    : segments

// 막대 연출이 끝나는 초, 이동 몫보다 늦게 끝나는 몫만
export const barEnd = (events: GameEvent[]) => {
  const start = forgeStart(events)
  return Math.max(
    0,
    ...events.map((e) => (e.type === 'barPushed' ? pushSeconds(e) : 0)),
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
}

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
    if (pushed) {
      const p = moveEase(clamp01(elapsed / pushSeconds(pushed)), chain)
      pose = pushPose(before, game, pushed, p)
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

    // 늘어난 수 끝에도 남는 달궈짐, 다음 수 동안 식는 빛
    const heat = heated
      ? smooth(clamp01((elapsed - (start ?? 0)) / FORGE.heat))
      : stretched || was.heat !== null || (!moving && stretchedIn(events, i))
        ? 1
        : moving && stretchedIn(prevEvents, i)
          ? 1 - smooth(t)
          : 0
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
