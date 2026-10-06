import { spotPoints } from './cellView'
import { blend } from './shadeView'
import { TILE } from '@/game/iso'
import type { Point, Stage } from '@/game/types'

// 수면이 같은 높이 땅 윗면보다 낮은 거리, 뜬 상자가 수면 아래로 잠긴 거리
export const WATER = { lip: 6, dip: 24 }

// 뜬 상자 둘레 물테 폭, 상자 폭 배수
export const COLLAR = 1.3

// 마른 땅에 닿은 먼 가장자리 반사 띠 폭, 칸 단위
const BANK = 0.13

// 그 순간 칸의 물 높이, 수위가 오르내리는 동안 소수
export type WaterAt = (p: Point) => number

const stillWater =
  (stage: Stage): WaterAt =>
  () =>
    stage.water ?? 0

// 물 높이에서 바닥까지 층 수, 물 칸이 아니면 0
export const waterDepth = (stage: Stage, { x, y }: Point, waterAt = stillWater(stage)) => {
  const h = stage.heights[y]?.[x]
  const level = waterAt({ x, y })
  return h !== undefined && h >= 0 && h < level ? level - h : 0
}

const isFloor = (stage: Stage, p: Point) => (stage.heights[p.y]?.[p.x] ?? -1) >= 0

// 마른 땅인 정도, 물이 오르내리는 동안 수면이 옅은 만큼 마른 쪽
const dryness = (stage: Stage, p: Point, waterAt: WaterAt) =>
  isFloor(stage, p) ? 1 - surfaceShown(waterDepth(stage, p, waterAt)) : 0

// 물 깊이와 반사 띠 진하기, bankX는 왼쪽 위 가장자리, bankY는 오른쪽 위 가장자리
// 옆면은 앞 칸이 바닥이 아닐 때만, 앞 칸이 흐려질 때 짙은 물 옆면이 비치는 탓
export const waterLook = (stage: Stage, p: Point, waterAt = stillWater(stage)) => {
  const depth = waterDepth(stage, p, waterAt)
  return {
    depth,
    bankX: depth > 0 ? dryness(stage, { x: p.x - 1, y: p.y }, waterAt) : 0,
    bankY: depth > 0 ? dryness(stage, { x: p.x, y: p.y - 1 }, waterAt) : 0,
    sideLeft: depth > 0 && !isFloor(stage, { x: p.x, y: p.y + 1 }),
    sideRight: depth > 0 && !isFloor(stage, { x: p.x + 1, y: p.y }),
  }
}

// 바닥 윗면에서 수면까지 화면 거리
export const surfaceRise = (depth: number) => depth * TILE.layer - WATER.lip

// 물속 바닥이 빛이 꺾여 떠 보이는 몫, 수면 위 물 깊이의 배수
const REFRACT = 0.3

// 물에 잠긴 바닥이 떠 보이는 px, 물 깊이를 따라 고르게
export const sunkLift = (depth: number) => REFRACT * Math.max(0, surfaceRise(depth))

// 잠기는 땅 위로 올라온 수면이 또렷해지기까지의 px
const SURFACE_FADE = 12

// 수면이 보이는 진하기, 땅 위로 막 올라온 수면은 옅은 값
export const surfaceShown = (depth: number) =>
  Math.min(1, Math.max(0, surfaceRise(depth) / SURFACE_FADE))

const toneOf = (depth: number) => `var(--color-water-${Math.min(3, Math.max(1, depth))})`

// 차오르는 중인 깊이는 위아래 색을 깊이만큼 섞은 색
export const waterTone = (depth: number) => {
  const low = Math.floor(depth)
  const high = Math.ceil(depth)
  return low < 1 || high > 3 || low === high
    ? toneOf(Math.ceil(depth))
    : blend(toneOf(low), toneOf(high), depth - low)
}

export const bankPoints = (x: number, y: number, side: 'x' | 'y') =>
  spotPoints(
    x,
    y,
    side === 'x'
      ? [
          [-0.5, -0.5],
          [-0.5 + BANK, -0.5],
          [-0.5 + BANK, 0.5],
          [-0.5, 0.5],
        ]
      : [
          [-0.5, -0.5],
          [0.5, -0.5],
          [0.5, -0.5 + BANK],
          [-0.5, -0.5 + BANK],
        ],
  )

// 수면 위로 보이는 상자 높이 px, bottom은 상자 밑면 층
export const floatShown = (bottom: number, water: number) =>
  Math.min(TILE.layer, Math.max(0, (bottom + 1 - water) * TILE.layer + WATER.lip))

export const floatShownAt = (
  stage: Stage,
  box: { x: number; y: number; level: number },
  waterAt = stillWater(stage),
) => {
  const cell = { x: Math.round(box.x), y: Math.round(box.y) }
  return waterDepth(stage, cell, waterAt) > 0 ? floatShown(box.level, waterAt(cell)) : null
}

// 칸에 멈춘 상자의 윗면이 바닥보다 높은 px와 수면 위로 보이는 px, 잠기는 땅 위 상자는 윗면 그대로
export const boatLook = (depth: number) => {
  const bottom = Math.max(0, depth - 1)
  return {
    top: (bottom + 1) * TILE.layer,
    shown: Math.min(TILE.layer, Math.max(0, (bottom + 1 - depth) * TILE.layer + WATER.lip)),
  }
}

// 가만히 있을 때 수면에 퍼지는 고리, 판 어딘가에 고리가 이는 간격 ms와 한 고리가 사는 ms, 칸 폭 배수 크기와 테 폭, 칸 안 자리
export const IDLE_RIPPLE = {
  gap: 2200,
  life: 1600,
  from: 0.18,
  to: 0.84,
  width: 0.06,
  at: { u: 0, v: 0 },
}

// 잔물결이 이는 물 칸과 그 차례, 칸마다 흩어진 순서, 소용돌이 칸 제외
export const idleRipples = (stage: Stage, waterAt = stillWater(stage)) => {
  const whirls = new Set(
    stage.entities.filter((e) => e.type === 'whirlpool').map((e) => `${e.x}-${e.y}`),
  )
  const cells = stage.heights.flatMap((row, y) =>
    row.flatMap((_, x) =>
      waterDepth(stage, { x, y }, waterAt) > 0 && !whirls.has(`${x}-${y}`) ? [{ x, y }] : [],
    ),
  )
  const spread = ({ x, y }: Point) => ((x * 73856093) ^ (y * 19349663)) >>> 0
  return new Map(cells.sort((a, b) => spread(a) - spread(b)).map((p, i) => [`${p.x}-${p.y}`, i]))
}

// 한 칸의 잔물결 한 바퀴 ms, 칸마다 gap씩 어긋나 판 전체로는 gap마다 하나, 고리가 겹치지 않는 최소 길이
export const rippleCycle = (cells: number) =>
  Math.max(cells * IDLE_RIPPLE.gap, IDLE_RIPPLE.life * 2)

// 잔물결 한 바퀴, 처음 life 동안만 퍼지며 옅어지는 판, inset은 테 폭만큼 작은 안쪽 판
// 바깥과 안쪽이 같은 크기만큼 자라 테 폭이 늘 같은 고리, 작을 때는 거의 꽉 찬 면
export const rippleLoop = (cycle: number, inset: boolean): Keyframe[] => {
  const { from, to, width } = IDLE_RIPPLE
  const start = inset ? (from - width) / (to - width) : from / to
  return [
    { opacity: 0.9, transform: `scale(${start})`, easing: 'ease-out' },
    { offset: IDLE_RIPPLE.life / cycle, opacity: 0, transform: 'scale(1)' },
    { opacity: 0, transform: 'scale(1)' },
  ]
}
