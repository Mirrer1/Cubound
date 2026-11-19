import {
  CUBE,
  NIGHT_PRE,
  type NightLight,
  VEIL_STEPS,
  type VeilBlock,
  cellVeil,
  coverPath,
  edgeFade,
  pileLumps,
  veilMiddle,
} from '../view'
import { clamp01, easeIn, easeOut } from './curveFrame'
import { SHADOW_SECONDS, fallProgress, shadowProgress, shadowSeconds } from './shadowFrame'
import { swampTime } from './swampFrame'
import { durationOf, moveSeconds } from './timeFrame'
import { TILE, toScreen } from '@/game/iso'
import { NIGHT_CYCLE, isNightStage, nightBeat, same, standHeight } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

export type NightPhase = 'light' | 'pre' | 'dark'

// 박자 자리 3은 어둠 1수 전, 4와 5는 어둠
export const nightPhase = (state: GameState): NightPhase => {
  const beat = nightBeat(state)
  return beat >= 4 ? 'dark' : beat === 3 ? 'pre' : 'light'
}

// NIGHT 숫자, 밝을 때는 다음 어둠까지 남은 수, 어두울 때는 남은 어둠 수
export const nightDisplay = (game: GameState | null) => {
  if (!game || !isNightStage(game.stage)) return null
  const beat = nightBeat(game)
  return { left: beat >= 4 ? NIGHT_CYCLE - beat : 4 - beat, phase: nightPhase(game) }
}

const GUIDE_FADE = 0.3
// 빛보다 높은 벽 옆면이 받는 빛의 몫
const WALL_LIGHT = 0.5

// 판 칸 어둠 세기가 한 수 동안 옮겨 가는 값과 시간
export interface NightBeat {
  from: number // 수 처음 어둠 세기 0~1
  to: number
  seconds: number
  delay: number
  ease: string
}

// 다리가 사라지는 가이드 단계에 보여 줄 어둠 장면, 박자만 첫 어둠 수로 옮긴 판
export const guideNightOf = (game: GameState, guideId: string | undefined): GameState | null =>
  guideId === 'shadowFade' && isNightStage(game.stage)
    ? { ...game, moves: game.moves + ((4 - nightBeat(game) + NIGHT_CYCLE) % NIGHT_CYCLE) }
    : null

// 게임 화면 바탕색과 1수 전 막, 그 수의 움직임 동안 바뀌어 큐브 도착에 맞춰 끝남
export const nightVeils = (prev: GameState | null, game: GameState, events: GameEvent[]) => {
  if (!isNightStage(game.stage)) return null
  const phase = nightPhase(game)
  // 가이드가 닫혀 어둠이 걷히는 때처럼 이동이 없는 바뀜도 짧게 이어 바꿈
  const swamp = swampTime(prev, game)
  // 되돌림과 메움이 있는 수는 이동 뒤에 걷히는 칸 막과 같은 때
  const settle = shadowSeconds(events) > 0
  const seconds = settle
    ? SHADOW_SECONDS
    : events.length > 0
      ? durationOf(events, swamp)
      : GUIDE_FADE
  const delay = settle ? moveSeconds(events, swamp) : 0
  // 어두워질 때도 처음에 확 바뀌고 끝에 잦아듦, 처음에 천천히 가다 끝에 확 바뀌면 끊겨 보임
  const ease = 'ease-out'
  const curve = `${seconds}s ${ease} ${delay}s`
  const front = phase === 'pre' ? NIGHT_PRE : 0
  const dark = phase === 'dark'
  return {
    phase,
    seconds,
    // 1수 전 막은 어둠이 내리는 수에 칸 어둠과 같은 곡선으로 걷혀 밝아졌다 어두워지는 출렁임 없음
    front: { opacity: front, transition: `opacity ${curve}` },
    back: {
      '--night-seconds': `${seconds}s`,
      '--night-delay': `${delay}s`,
      '--night-ease': ease,
      backgroundColor: dark ? 'var(--color-night)' : 'var(--color-base-bg)',
      transition: `background-color ${curve}, border-color ${curve}`,
    },
    // 판 칸 어둠 세기, 바탕과 같은 시간과 곡선
    field: {
      from: nightPhase(prev ?? game) === 'dark' ? 1 : 0,
      to: dark ? 1 : 0,
      seconds,
      delay,
      ease: ease,
    } satisfies NightBeat,
  }
}

// 그림자 다리 진하기, 1수 전은 반
const BRIDGE: Record<NightPhase, number> = { light: 0, pre: 0.5, dark: 1 }

const braziers = (game: GameState): Point[] =>
  (game.stage.fire ?? []).flatMap((row, y) =>
    [...row].flatMap((c, x) => (c === '@' ? [{ x, y }] : [])),
  )

// 큐브, 타는 숯, 화로의 빛, 이번 수에 켜지거나 꺼지는 숯은 세기를 이어 바꿈
const nightLights = (
  prev: GameState | null,
  game: GameState,
  t: number,
  cube: { x: number; y: number },
  settled?: number, // 큐브 빛을 출발 칸 0이나 도착 칸 1에 둔 값
  dropping = false, // 다시 시작해 내려앉는 중, 큐브가 아직 안 온 자리에 큐브 빛을 안 켬
  lifting = false, // 이 수 끝에 어둠이 걷힘, 떠나는 칸 빛을 끄지 않음(꺼졌다 밝아지면 그 칸 물건이 까맣게 깜빡임)
): NightLight[] => {
  const before = prev?.burning ?? game.burning
  const has = (list: Point[], p: Point) => list.some((q) => same(q, p))
  const spot = (p: Point, weight: number) => ({
    ...p,
    h: standHeight(game, p),
    wide: false,
    weight,
  })
  // 칸에 붙은 큐브 빛, 도착 칸은 가는 내내 켜져 도착할 때 다 켜지고 떠나는 칸은 뒤 절반에 꺼지는 바뀜
  const from = prev?.player ?? game.player
  const to = game.player
  const arrived = settled ?? snap(cubeArrived(prev, game, cube))
  const cubeLight = (p: Point, flame: number, weight: number) => ({
    ...p,
    h: standHeight(game, p),
    wide: flame > 0,
    weight,
    cube: true,
  })
  const cubeLights = dropping
    ? []
    : [
        cubeLight(to, game.flame, arrived),
        ...(arrived < 1 || lifting
          ? [
              cubeLight(
                from,
                prev?.flame ?? game.flame,
                lifting ? 1 : Math.min(1, (1 - arrived) * 2),
              ),
            ]
          : []),
      ]
  return [
    ...cubeLights,
    ...game.burning.map((p) => spot(p, has(before, p) ? 1 : snap(t))),
    ...before.filter((p) => !has(game.burning, p)).map((p) => spot(p, 1 - snap(t))),
    ...braziers(game).map((p) => spot(p, 1)),
  ]
}

interface NightInput {
  prev: GameState | null
  game: GameState
  events: GameEvent[]
  t: number
  cube: { x: number; y: number } // 지금 그려지는 큐브 자리
  dropping?: boolean // 다시 시작해 내려앉는 중
}

export interface NightScene {
  field: number // 칸 막 세기 몫, 칸 막은 field × 빛 지도 값
  bridge: number // 그림자 다리 진하기
  veilOf: (p: Point, h: number) => { top: number[]; sides: number[] } // 칸 윗면과 옆면 빛 지도, 8x8 또는 고른 값 하나
  settledVeilOf: (settled: number) => (p: Point, h: number) => { top: number[]; sides: number[] } // 큐브 빛을 출발 칸 0에서 도착 칸 1 사이 어디에 둔 빛 지도
  arrived: number // 큐브가 간 몫 0~1, 1/8로 끊지 않은 값
  sinking: Point[] // 밝아질 때 다리에서 빠져 메우는 상자 칸
  sink: number // 그 상자가 내려간 층 0~1
}

export interface NightCell {
  veil: string // 윗면 빛 지도 8x8 또는 하나를 쉼표로 이음
  sides: string // 옆면 빛 지도, 윗면과 같으면 빈 글자
  cover: string // 물건 모양 덮개 블록마다 x y 폭 높이, 쉼표로 이음
  depth: number // 칸 옆면 높이 px
  openLeft: boolean // 왼쪽 앞 칸이 낮거나 없음
  openRight: boolean // 오른쪽 앞 칸이 낮거나 없음
  openBackLeft: boolean // 왼쪽 뒤 칸이 없거나 구덩이
  openBackRight: boolean // 오른쪽 뒤 칸이 없거나 구덩이
  hole: string // 지나가는 상자 모양 경로, 바닥 막에서 잘라 냄
}

const BLOCK: VeilBlock = { x: 0, y: 0, width: TILE.width * CUBE, height: TILE.layer }

// 남은 숯 벽 더미는 덩이마다, 상자와 화약통은 블록 하나, 밀려 가는 상자와 큐브는 그림이 덮개를 데려감
const coverOf = (
  game: GameState,
  p: Point,
  moving: Point | null,
  dropping = false,
): VeilBlock[] => {
  const pile = (game.stage.fire?.[p.y]?.[p.x] ?? '.') === '#'
  if (pile && !game.ashes.some((q) => same(q, p)))
    return pileLumps((p.x + p.y) % 2 === 1).map((l) => ({
      x: ((l.u - l.v) * TILE.width) / 2,
      y: ((l.u + l.v) * TILE.height) / 2 - l.z,
      width: TILE.width * l.scale,
      height: l.height,
    }))
  // 다시 시작해 내려앉는 상자는 덮개 없이 제 색으로 나타남, 판이 같이 밝아지는 중
  const box = !dropping && game.boxes.some((q) => same(q, p)) && !(moving && same(moving, p))
  const block = box || game.kegs.some((q) => same(q, p))
  return block ? [BLOCK] : []
}

export const nightCellOf = (
  night: NightScene,
  game: GameState,
  p: Point,
  h: number,
  moving: MovingCover[],
  dropping = false,
): NightCell => {
  const { top, sides } = night.veilOf(p, h)
  return {
    veil: top.join(','),
    sides: sides === top ? '' : sides.join(','),
    cover: coverOf(game, p, moving.find((m) => same(m.to, p))?.to ?? null, dropping)
      .map((b) => [b.x, b.y, b.width, b.height].join(' '))
      .join(','),
    depth: h * TILE.layer + TILE.lip,
    openLeft: (game.heights[p.y + 1]?.[p.x] ?? -1) < h,
    openRight: (game.heights[p.y]?.[p.x + 1] ?? -1) < h,
    openBackLeft: (game.heights[p.y]?.[p.x - 1] ?? -1) < 0,
    openBackRight: (game.heights[p.y - 1]?.[p.x] ?? -1) < 0,
    hole: moving.find((m) => m.cells.some((q) => same(q, p)))?.d ?? '',
  }
}

export interface MovingCover {
  to: Point
  cells: Point[] // 상자가 지나며 바닥 막에서 상자 모양을 잘라 낼 칸
  d: string
  opacity: number
}

// 밀려 가는 상자를 따라가는 덮개, 세기는 상자가 지금 걸친 자리의 빛 지도 가운데 값
export const movingBoxCover = (
  night: NightScene,
  frame: { x: number; y: number; to: Point; cell: Point },
  box: { x: number; y: number; level: number },
  events: GameEvent[],
): MovingCover => ({
  to: frame.to,
  cells: [frame.cell, ...events.flatMap((e) => (e.type === 'pushed' ? [e.from, e.to] : []))],
  d: coverPath(frame.x, frame.y + TILE.layer, [BLOCK]),
  opacity: pushedBoxVeil(night, box, events),
})

// 구르는 큐브를 따라가는 덮개, 세기는 출발 칸의 처음 빛에서 도착 칸의 끝 빛으로 이어 바꿈
export const cubeCover = (
  night: NightScene,
  prev: GameState | null,
  game: GameState,
  scene: {
    cube: { x: number; y: number; level: number; lift: number }
    cubeCell: Point
    cubeFaces: { points: string }[]
    cubeSink: number
  },
): MovingCover => {
  const { cube } = scene
  const dy = scene.cubeSink - cube.lift
  const d = scene.cubeFaces
    .map(({ points }) => {
      const shifted = points.split(' ').map((pt) => {
        const [x, y] = pt.split(',').map(Number)
        return `${x},${y + dy}`
      })
      return `M${shifted.join(' ')}Z`
    })
    .join(' ')
  const from = prev?.player ?? game.player
  const to = game.player
  const h = Math.round(cube.level)
  const span = Math.hypot(to.x - from.x, to.y - from.y)
  const gone = span === 0 ? 1 : clamp01(Math.hypot(cube.x - from.x, cube.y - from.y) / span)
  const start = veilMiddle(night.settledVeilOf(0)(from, h).top)
  const end = veilMiddle(night.settledVeilOf(1)(to, h).top)
  return {
    to: scene.cubeCell,
    cells: [from, to, scene.cubeCell],
    d,
    opacity: start + (end - start) * gone,
  }
}

// 밀리는 상자 어둠은 출발 칸의 처음 빛에서 도착 칸의 끝 빛으로 이어 바꿈, 큐브 빛이 칸 사이에서 나뉘는 출렁임 없음
const pushedBoxVeil = (
  night: NightScene,
  box: { x: number; y: number; level: number },
  events: GameEvent[],
) => {
  const h = Math.round(box.level)
  const push = events.find((e) => e.type === 'pushed')
  if (push?.type !== 'pushed') return veilMiddle(night.veilOf({ x: box.x, y: box.y }, h).top)
  const span = Math.hypot(push.to.x - push.from.x, push.to.y - push.from.y)
  const gone = span === 0 ? 1 : clamp01(Math.hypot(box.x - push.from.x, box.y - push.from.y) / span)
  const start = veilMiddle(night.settledVeilOf(0)(push.from, h).top)
  const end = veilMiddle(night.settledVeilOf(1)(push.to, h).top)
  return start + (end - start) * gone
}

// 밝아질 때 다리에서 빠져 가라앉는 상자의 덮개, 그 칸 바닥 막에서 상자 모양을 잘라 냄
export const sinkingBoxCovers = (night: NightScene, game: GameState): MovingCover[] =>
  night.sinking.map((p) => {
    const h = game.heights[p.y][p.x]
    const { x, y } = toScreen(p, h)
    return {
      to: p,
      cells: [p],
      d: coverPath(x, y + night.sink * TILE.layer, [BLOCK]),
      opacity: veilMiddle(night.veilOf(p, h).top),
    }
  })

// 그림자 다리 칸이 빛을 받은 몫, 어둠에만 0보다 큼
// 끊지 않은 큐브 빛으로 재서 매 프레임 이어 바뀜
export const bridgeLight = (night: NightScene | null, p: Point, level: number) =>
  night ? (1 - veilMiddle(night.settledVeilOf(night.arrived)(p, level).top)) * night.field : 0

// 그림자 다리 위에 멈춘 상자와 덮개, 칸 중심 화면 자리와 다리 높이로 셈
export const stillBoxCover = (
  night: NightScene,
  cell: { x: number; y: number; p: Point },
  level: number,
) => {
  const top = cell.y - (level + 1) * TILE.layer
  return {
    top,
    d: coverPath(cell.x, top + TILE.layer, [BLOCK]),
    opacity: veilMiddle(night.veilOf(cell.p, level).top),
  }
}

// 큐브가 출발 칸에서 도착 칸까지 간 몫 0~1
const cubeArrived = (prev: GameState | null, game: GameState, cube: { x: number; y: number }) => {
  const from = prev?.player ?? game.player
  const to = game.player
  const span = Math.hypot(to.x - from.x, to.y - from.y)
  return span === 0 ? 1 : clamp01(Math.hypot(cube.x - from.x, cube.y - from.y) / span)
}

// 빛이 1/8칸씩 옮겨 가는 자리, 그 사이에는 칸 막을 다시 안 그림
const snap = (v: number) => Math.round(v * VEIL_STEPS) / VEIL_STEPS

export const nightScene = ({
  prev,
  game,
  events,
  t,
  cube,
  dropping = false,
}: NightInput): NightScene | null => {
  if (!isNightStage(game.stage)) return null
  const from = nightPhase(prev ?? game)
  const to = nightPhase(game)
  if (from === 'light' && to === 'light') return null

  // 되돌림과 메움이 있는 수는 이동 뒤에 걷힘
  const swamp = swampTime(prev, game)
  const move = moveSeconds(events, swamp)
  const elapsed = t * durationOf(events, swamp)
  const p = shadowSeconds(events) > 0 ? shadowProgress(elapsed, move) : t
  const e = to === 'pre' ? p : easeOut(p)
  const mix = (a: number, b: number) => a + (b - a) * e
  const fieldOf = (phase: NightPhase) => (phase === 'dark' ? 1 : 0)

  const lit = from === 'dark' || to === 'dark'
  const field = mix(fieldOf(from), fieldOf(to))
  const veilFor = (lights: NightLight[]) => (q: Point, h: number) => {
    if (!lit) return { top: [1], sides: [1] }
    const ground = (x: number, y: number) =>
      (game.heights[Math.round(y)]?.[Math.round(x)] ?? -1) < 0
    const edges = {
      left: ground(q.x - 1, q.y),
      right: ground(q.x + 1, q.y),
      back: ground(q.x, q.y - 1),
      front: ground(q.x, q.y + 1),
    }
    // 칸보다 낮은 빛은 윗면에 닿지 않고 옆면만 비춤
    // 윗면은 판 끝까지 꽉 차게 밝고, 판 끝 옆면 띠만 판 끝 쪽으로 사그라져 까맘
    const litSides = edgeFade(cellVeil(lights, q.x, q.y), edges)
    const above = lights.filter((l) => l.h >= h)
    const high = above.length < lights.length
    // 빛보다 높은 벽의 옆면은 바닥보다 덜 밝게, 바닥만큼 밝으면 빛 기둥처럼 보임
    const sides = high ? litSides.map((v) => 1 - (1 - v) * WALL_LIGHT) : litSides
    const top = cellVeil(high ? above : lights, q.x, q.y)
    return { top, sides }
  }

  return {
    field,
    bridge: mix(BRIDGE[from], BRIDGE[to]),
    veilOf: veilFor(
      lit ? nightLights(prev, game, t, cube, undefined, dropping, to === 'light') : [],
    ),
    settledVeilOf: (settled) =>
      veilFor(lit ? nightLights(prev, game, t, cube, settled, dropping, to === 'light') : []),
    arrived: cubeArrived(prev, game, cube),
    sinking: events.flatMap((ev) => (ev.type === 'shadowFilled' ? [ev.at] : [])),
    sink: easeIn(fallProgress(elapsed, move)),
  }
}
