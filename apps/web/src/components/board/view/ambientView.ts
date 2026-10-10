import type { ViewBox } from './cameraView'
import { TILE, toScreen } from '@/game/iso'
import { isIce, same } from '@/game/rules'
import type { GameState, Point, Stage } from '@/game/types'

export type AmbientKind =
  | 'mote'
  | 'warp'
  | 'bubble'
  | 'spore'
  | 'butterfly'
  | 'mist'
  | 'ash'
  | 'emberSmoke'
  | 'brazierSmoke'
  | 'brazierSpark'

export type AmbientShape =
  | 'mote'
  | 'dish'
  | 'ring'
  | 'bubble'
  | 'disk'
  | 'spore'
  | 'wingLeft'
  | 'wingRight'
  | 'wisp'
  | 'sheetLeft'
  | 'sheetRight'
  | 'dust'
  | 'flake'
  | 'smoke'
  | 'brazierSmoke'
  | 'sparkCore'
  | 'sparkHot'

// 한 번 일어나는 ms와 크기 px, 칸 폭 배수
export const AMBIENT = {
  mote: { life: 2950, size: 3.6 },
  warp: { life: 2600, dish: 0.46, ring: 0.98, rim: 0.05 },
  bubble: { life: 1600, size: 5, disk: 30 },
  spore: { life: 2700, size: 2.2 },
  butterfly: { life: 4400, wing: 5, height: 4 },
  mist: { life: 2550, sheet: { rx: 20, ry: 8 }, wisp: { rx: 9, ry: 5 } },
  ash: { life: 2950, flake: { rx: 4.5, ry: 2.6 }, dust: 0.62 },
  emberSmoke: { life: 3800, rx: 16, ry: 7 },
  brazierSmoke: { life: 4300, rx: 20, ry: 8 },
  brazierSpark: { life: 1650, size: 2.2 },
}

// 한 번 끝난 뒤 쉬는 ms, 바닥 연출이 없는 장에서 그 자리를 비우는 ms
const REST = 1400
const GAP = 2000

// 장마다 빈 바닥에 일어나는 연출
const FLOOR: Partial<Record<number, AmbientKind>> = { 1: 'mote', 2: 'butterfly', 4: 'ash' }

// 빛 알갱이 셋의 늦는 ms, 칸 가운데에서 떠나는 자리와 벌어지는 거리 px
const MOTES = [
  { delay: 0, from: -6, spread: -22 },
  { delay: 350, from: 5, spread: 22 },
  { delay: 700, from: 0, spread: 3 },
]

// 포자 다섯의 갓 가장자리 자리, 옆으로 퍼지는 거리와 멈추는 높이 px
const SPORES = [
  { x: -14, y: -18, dx: -18, top: -26 },
  { x: 14, y: -19, dx: 18, top: -27 },
  { x: -6, y: -23, dx: -10, top: -28 },
  { x: 6, y: -23, dx: 12, top: -28.5 },
  { x: 0, y: -25, dx: 2, top: -29 },
]

// 나비 몸 자리 ms, x, y, 날개 하나 폭, 진하기
const FLIGHT: [number, number, number, number, number][] = [
  [0, 34, -24, 5, 0],
  [250, 28, -21, 2, 0.9],
  [500, 21, -16, 5, 0.9],
  [750, 13, -11, 2, 0.9],
  [1000, 6, -6, 5, 0.9],
  [1200, 0, -3, 5, 0.9],
  [1700, 0, -3, 5, 0.9],
  [1800, 0, -3, 1.4, 0.9],
  [2000, 0, -3, 5, 0.9],
  [2300, -7, -7, 2, 0.9],
  [2600, -14, 1, 5, 0.9],
  [3100, -14, 1, 5, 0.9],
  [3200, -14, 1, 1.4, 0.9],
  [3400, -14, 1, 5, 0.9],
  [3800, -18, -5, 2, 0.9],
  [4000, -24, -12, 5, 0.9],
  [4200, -29, -19, 2, 0.6],
  [4400, -34, -25, 5, 0],
]

export interface AmbientSlot {
  at: number // 바퀴 안에서 시작하는 ms
  kind: AmbientKind
}

export interface AmbientPlan {
  cycle: number // 한 바퀴 ms
  slots: AmbientSlot[]
}

const marked = (rows: string[] | undefined, { x, y }: Point) => (rows?.[y]?.[x] ?? '.') !== '.'

const anyMarked = (rows: string[] | undefined) => rows?.some((row) => /[^.]/.test(row)) ?? false

// 찬 김 조각의 칸 윗면 가운데 기준 자리와 크기, ms마다 x, y, rx, ry, 진하기
const SHEET: [number, number, number, number, number, number][] = [
  [0, 8, 10, 6, 3, 0],
  [400, 14, 11, 10, 4.5, 0.45],
  [1600, 26, 12, 18, 7, 0.22],
  [2400, 30, 12, 20, 8, 0],
]
const WISP: [number, number, number, number, number, number][] = [
  [0, -1, -30, 3, 3, 0],
  [400, -4, -31, 5, 3.6, 0.5],
  [1600, -10, -32.5, 8, 4.6, 0.22],
  [2400, -12, -33, 9, 5, 0],
]

// 재 송이의 칸 윗면 가운데 기준 ms마다 x, y, rx, ry, 진하기, 뒤집히듯 오가는 ry
const FLAKE: [number, number, number, number, number, number][] = [
  [0, 10, -26, 4.5, 2.6, 0],
  [300, 8.5, -24, 4.5, 1.4, 0.85],
  [800, 4.5, -14.3, 4.5, 2.6, 0.85],
  [1300, 2, -5.2, 4.5, 1.4, 0.85],
  [1700, 0, 0, 4.5, 2.2, 0.85],
  [2800, 0, 0, 3.5, 1.8, 0],
]

// 재 먼지의 ms마다 칸 폭 배수와 진하기
const DUST: [number, number, number][] = [
  [0, 0.15, 0],
  [1700, 0.15, 0],
  [1800, 0.2, 0.55],
  [2400, 0.5, 0.38],
  [2900, 0.62, 0],
]

// 꺼진 불씨 칸 연기 한 가닥의 ms마다 옆으로 간 몫, y, rx, ry, 진하기와 두 가닥의 늦는 ms, 옆으로 가는 px
const SMOKE: [number, number, number, number, number, number][] = [
  [0, 0, -3, 2.5, 2.5, 0],
  [500, 0.2, -7, 5, 3.5, 0.45],
  [2000, 0.7, -13, 12, 6, 0.28],
  [3000, 1, -16, 16, 7, 0],
]
const THREADS = [
  { delay: 0, dx: 18 },
  { delay: 800, dx: -16 },
]

// 화로 연기 한 덩이의 ms마다 옆으로 간 몫, y, rx, ry, 진하기와 두 덩이의 늦는 ms, 옆으로 가는 px
const PUFF: [number, number, number, number, number, number][] = [
  [0, 0, -10, 4, 3.5, 0],
  [500, 0.15, -14, 8, 5, 0.5],
  [2000, 0.6, -24, 16, 7, 0.3],
  [3200, 1, -30, 20, 8, 0],
]
const PUFFS = [
  { delay: 0, dx: -15 },
  { delay: 1100, dx: 15 },
]

// 화로 불티 넷의 그릇 안에서 벌어지는 px, 0.25초씩 늦게 0.9초
const SPARKS = [-24, -8, 8, 24]
const SPARK_LIFE = 900

// 판의 한 바퀴 차례, 바닥 연출 다음 그 판의 요소 연출, 한 번에 하나, 끝나고 REST 쉼
// 바닥 연출은 그 장만, 요소 연출은 그 요소가 있는 모든 판, 둘 다 없으면 null
export const ambientPlan = (stage: Stage, chapter: number): AmbientPlan | null => {
  const floor = FLOOR[chapter] ?? null
  const elements: AmbientKind[] = [
    ...(anyMarked(stage.swamp) ? ['bubble' as const] : []),
    ...(anyMarked(stage.mushroom) ? ['spore' as const] : []),
    ...(stage.entities.some((e) => e.type === 'iceStone') ? ['mist' as const] : []),
    ...(stage.entities.some((e) => e.type === 'warp') ? ['warp' as const] : []),
    ...(stage.fire?.some((row) => row.includes('*')) ? ['emberSmoke' as const] : []),
    ...(stage.fire?.some((row) => row.includes('@'))
      ? ['brazierSmoke' as const, 'brazierSpark' as const]
      : []),
  ]
  if (!floor && elements.length === 0) return null
  const slots: AmbientSlot[] = []
  let at = 0
  for (const kind of [floor, ...elements]) {
    if (kind) slots.push({ at, kind })
    at += kind ? AMBIENT[kind].life + REST : GAP
  }
  return { cycle: at, slots }
}

// 칸마다 흩어진 순서, 바퀴와 차례마다 다른 값, 비트를 고루 섞는 정수 해시
const spread = ({ x, y }: Point, seed: number) => {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed, 83492791)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b)
  return (h ^ (h >>> 16)) >>> 0
}

// 지금 화면 안 칸, 칸 윗면 가운데가 화면 가장자리에서 반 칸 넘게 안쪽, 화면을 모르면 모든 칸
const inView = (game: GameState, p: Point, view?: ViewBox) => {
  if (!view) return true
  const [x, y, width, height] = view
  const at = toScreen(p, Math.max(0, game.heights[p.y][p.x]))
  return (
    at.x > x + TILE.width / 2 &&
    at.x < x + width - TILE.width / 2 &&
    at.y > y + TILE.height &&
    at.y < y + height - TILE.height / 2
  )
}

const apart = (p: Point, q: Point) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) > 1

// 아무것도 없는 보통 땅
const isBare = (game: GameState, p: Point) => {
  const { stage } = game
  const h = stage.heights[p.y][p.x]
  const things = [
    ...game.boxes,
    ...game.stones,
    ...game.tethered,
    ...game.ladders,
    ...game.leaningLadders,
    ...game.seeds,
    ...game.planted,
    ...stage.entities,
    ...stage.entities.flatMap((e) => (e.type === 'tram' || e.type === 'vine' ? e.cells : [])),
  ]
  return (
    h >= 0 &&
    game.heights[p.y][p.x] === h &&
    h >= (stage.water ?? 0) &&
    !same(p, stage.goal) &&
    !isIce(game, p) &&
    !marked(stage.swamp, p) &&
    !marked(stage.mushroom, p) &&
    !marked(stage.cracks, p) &&
    !marked(stage.fire, p) &&
    !things.some((thing) => same(thing, p))
  )
}

// 상자가 올라서지 않은 화로
const braziersOf = (game: GameState) =>
  (game.stage.fire ?? []).flatMap((row, y) =>
    [...row].flatMap((c, x) =>
      c === '@' && !game.boxes.some((b) => same(b, { x, y })) ? [{ x, y }] : [],
    ),
  )

// 연출이 일어날 수 있는 칸, 큐브 칸과 상하좌우 칸 제외, 찬 김은 모든 얼음 돌
const candidates = (game: GameState, kind: AmbientKind) => {
  const cells =
    kind === 'bubble'
      ? game.swamps
      : kind === 'spore'
        ? game.mushrooms
        : kind === 'mist'
          ? game.stones
          : kind === 'emberSmoke'
            ? game.sparks
            : kind === 'brazierSmoke' || kind === 'brazierSpark'
              ? braziersOf(game)
              : game.stage.heights.flatMap((row, y) =>
                  row.flatMap((_, x) => (isBare(game, { x, y }) ? [{ x, y }] : [])),
                )
  return kind === 'mist' ? cells : cells.filter((p) => apart(p, game.player))
}

// 이번 차례에 연출이 일어나는 칸, 짝 칸 숨은 한 짝의 두 칸, 고를 칸이 없으면 빈 목록
// last는 같은 연출의 바로 앞 칸, 그 칸과 상하좌우 칸은 다른 칸이 있을 때 제외
export const ambientCells = (
  game: GameState,
  kind: AmbientKind,
  round: number,
  slot: number,
  last: Point[] = [],
  view?: ViewBox,
): Point[] => {
  const { stage } = game
  if (kind === 'warp') {
    const ids = [
      ...new Set(stage.entities.flatMap((e) => (e.type === 'warp' ? [e.id] : []))),
    ].sort()
    const pairs = ids
      .map((id) =>
        stage.entities.flatMap((e) =>
          e.type === 'warp' && e.id === id ? [{ x: e.x, y: e.y }] : [],
        ),
      )
      .filter((pair) => pair.some((p) => inView(game, p, view)))
    return pairs.length > 0 ? pairs[round % pairs.length] : []
  }
  const seed = round * 8 + slot
  const cells = candidates(game, kind)
    .filter((p) => inView(game, p, view))
    .sort((a, b) => spread(a, seed) - spread(b, seed))
  const away = cells.filter((p) => last.every((q) => apart(p, q)))
  return (away.length > 0 ? away : cells).slice(0, 1)
}

// 한 바퀴 안의 키프레임, ms를 바퀴 길이 비로
const at = (ms: number, cycle: number) => ms / cycle

const move = (dx: number, dy: number) => `translate(${dx}px, ${dy}px)`

export interface AmbientLoop {
  shape: AmbientShape
  delay: number // 차례 시작에서 늦는 ms
  keyframes: Keyframe[] // 한 바퀴 키프레임
}

// 연출 한 번을 이루는 조각마다 그림, 늦는 ms, 한 바퀴 키프레임
export const ambientLoops = (kind: AmbientKind, cycle: number): AmbientLoop[] => {
  if (kind === 'mote') {
    return MOTES.map(({ delay, from, spread }) => {
      const end = { opacity: 0, transform: move(from + spread * 1.1, -17) }
      return {
        shape: 'mote',
        delay,
        keyframes: [
          { offset: 0, opacity: 0, transform: move(from, 2), easing: 'ease-out' },
          { offset: at(450, cycle), opacity: 0.6, transform: move(from + spread * 0.15, -2) },
          { offset: at(1770, cycle), opacity: 0.4, transform: move(from + spread, -14) },
          { offset: at(2250, cycle), ...end },
          { offset: 1, ...end },
        ],
      }
    })
  }
  if (kind === 'bubble') {
    const { size, disk } = AMBIENT.bubble
    const grow = (r: number) => `scale(${r / size})`
    const wide = (rx: number) => `scale(${rx / disk})`
    return [
      {
        shape: 'bubble',
        delay: 0,
        keyframes: [
          { offset: 0, opacity: 0, transform: grow(0.6) },
          { offset: at(50, cycle), opacity: 0.7, transform: grow(0.8) },
          { offset: at(900, cycle), opacity: 0.7, transform: grow(5) },
          { offset: at(960, cycle), opacity: 0, transform: grow(5) },
          { offset: 1, opacity: 0, transform: grow(5) },
        ],
      },
      {
        shape: 'disk',
        delay: 0,
        keyframes: [
          { offset: 0, opacity: 0, transform: wide(5) },
          { offset: at(900, cycle), opacity: 0, transform: wide(5) },
          { offset: at(950, cycle), opacity: 0.45, transform: wide(6), easing: 'ease-out' },
          { offset: at(1600, cycle), opacity: 0, transform: wide(30) },
          { offset: 1, opacity: 0, transform: wide(30) },
        ],
      },
    ]
  }
  if (kind === 'spore') {
    return SPORES.map(({ x, y, dx, top }, i) => {
      const end = { opacity: 0, transform: move(x + dx, top) }
      return {
        shape: 'spore',
        delay: i * 200,
        keyframes: [
          { offset: 0, opacity: 0, transform: move(x, y) },
          { offset: at(200, cycle), opacity: 0.85, transform: move(x + dx * 0.15, y - 1) },
          { offset: at(1500, cycle), opacity: 0.5, transform: move(x + dx, top) },
          { offset: at(1900, cycle), ...end },
          { offset: 1, ...end },
        ],
      }
    })
  }
  if (kind === 'butterfly') {
    const { wing } = AMBIENT.butterfly
    const frames = FLIGHT.map(([ms, x, y, width, opacity]) => ({
      offset: at(ms, cycle),
      opacity,
      transform: `${move(x, y)} scaleX(${width / wing})`,
    }))
    const keyframes = [...frames, { ...frames.at(-1)!, offset: 1 }]
    return [
      { shape: 'wingLeft', delay: 0, keyframes },
      { shape: 'wingRight', delay: 0, keyframes },
    ]
  }
  if (kind === 'mist') {
    const { sheet, wisp } = AMBIENT.mist
    const puff = (
      frames: typeof SHEET,
      base: { rx: number; ry: number },
      side: number,
    ): Keyframe[] => {
      const steps = frames.map(([ms, x, y, rx, ry, opacity]) => ({
        offset: at(ms, cycle),
        opacity,
        transform: `${move(side * x, y)} scale(${rx / base.rx}, ${ry / base.ry})`,
      }))
      return [...steps, { ...steps.at(-1)!, offset: 1 }]
    }
    return [
      { shape: 'wisp', delay: 0, keyframes: puff(WISP, wisp, 1) },
      { shape: 'sheetLeft', delay: 0, keyframes: puff(SHEET, sheet, -1) },
      { shape: 'sheetRight', delay: 150, keyframes: puff(SHEET, sheet, 1) },
    ]
  }
  if (kind === 'ash') {
    const { flake } = AMBIENT.ash
    const dust = DUST.map(([ms, k, opacity]) => ({
      offset: at(ms, cycle),
      opacity,
      transform: `scale(${k / AMBIENT.ash.dust})`,
    }))
    const fall = FLAKE.map(([ms, x, y, rx, ry, opacity]) => ({
      offset: at(ms, cycle),
      opacity,
      transform: `${move(x, y)} scale(${rx / flake.rx}, ${ry / flake.ry})`,
    }))
    return [
      { shape: 'dust', delay: 0, keyframes: [...dust, { ...dust.at(-1)!, offset: 1 }] },
      { shape: 'flake', delay: 0, keyframes: [...fall, { ...fall.at(-1)!, offset: 1 }] },
    ]
  }
  if (kind === 'emberSmoke') {
    const { rx: baseX, ry: baseY } = AMBIENT.emberSmoke
    return THREADS.map(({ delay, dx }) => {
      const steps = SMOKE.map(([ms, side, y, rx, ry, opacity]) => ({
        offset: at(ms, cycle),
        opacity,
        transform: `${move(dx * side, y)} scale(${rx / baseX}, ${ry / baseY})`,
      }))
      return { shape: 'smoke', delay, keyframes: [...steps, { ...steps.at(-1)!, offset: 1 }] }
    })
  }
  if (kind === 'brazierSmoke') {
    const { rx: baseX, ry: baseY } = AMBIENT.brazierSmoke
    return PUFFS.map(({ delay, dx }) => {
      const steps = PUFF.map(([ms, side, y, rx, ry, opacity]) => ({
        offset: at(ms, cycle),
        opacity,
        transform: `${move(dx * side, y)} scale(${rx / baseX}, ${ry / baseY})`,
      }))
      return {
        shape: 'brazierSmoke',
        delay,
        keyframes: [...steps, { ...steps.at(-1)!, offset: 1 }],
      }
    })
  }
  if (kind === 'brazierSpark') {
    return SPARKS.map((dx, i) => {
      const end = { opacity: 0, transform: move(dx, -24) }
      return {
        shape: i % 2 ? 'sparkHot' : 'sparkCore',
        delay: i * 250,
        keyframes: [
          { offset: 0, opacity: 0, transform: move(0, -9), easing: 'ease-out' },
          { offset: at(150, cycle), opacity: 1, transform: move(dx * 0.25, -13) },
          { offset: at(SPARK_LIFE, cycle), ...end },
          { offset: 1, ...end },
        ],
      }
    })
  }
  const { ring, rim } = AMBIENT.warp
  // 테 가운데 선 크기, 가장 클 때를 1로
  const scale = (outer: number) => `scale(${(outer - rim / 2) / (ring - rim / 2)})`
  const breath = (peak: number, from: Keyframe, top: Keyframe, to: Keyframe): Keyframe[] => [
    { offset: 0, opacity: 0, easing: 'ease-in-out', ...from },
    { offset: at(1100, cycle), opacity: peak, easing: 'ease-in-out', ...top },
    { offset: at(2600, cycle), opacity: 0, ...to },
    { offset: 1, opacity: 0, ...to },
  ]
  return [
    { shape: 'dish', delay: 0, keyframes: breath(0.85, {}, {}, {}) },
    {
      shape: 'ring',
      delay: 0,
      keyframes: breath(
        0.7,
        { transform: scale(0.86) },
        { transform: scale(0.93) },
        { transform: scale(ring) },
      ),
    },
  ]
}
