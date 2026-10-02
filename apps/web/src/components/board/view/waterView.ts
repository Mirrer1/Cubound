import { spotPoints } from './cellView'
import { TILE } from '@/game/iso'
import type { Point, Stage } from '@/game/types'

// 수면이 같은 높이 땅 윗면보다 낮은 거리, 뜬 상자가 수면 아래로 잠긴 거리
export const WATER = { lip: 6, dip: 24 }

// 뜬 상자 둘레 물테 폭, 상자 폭 배수
export const COLLAR = 1.3

// 마른 땅에 닿은 먼 가장자리 반사 띠 폭, 칸 단위
const BANK = 0.13

// 물 높이에서 바닥까지 층 수, 물 칸이 아니면 0
export const waterDepth = (stage: Stage, { x, y }: Point) => {
  const h = stage.heights[y]?.[x]
  const level = stage.water ?? 0
  return h !== undefined && h >= 0 && h < level ? level - h : 0
}

const isFloor = (stage: Stage, p: Point) => (stage.heights[p.y]?.[p.x] ?? -1) >= 0

const isDry = (stage: Stage, p: Point) => isFloor(stage, p) && waterDepth(stage, p) === 0

// 물 깊이와 반사 띠 자리, bankX는 왼쪽 위 가장자리, bankY는 오른쪽 위 가장자리
// 옆면은 앞 칸이 바닥이 아닐 때만, 앞 칸이 흐려질 때 짙은 물 옆면이 비치는 탓
export const waterLook = (stage: Stage, p: Point) => {
  const depth = waterDepth(stage, p)
  return {
    depth,
    bankX: depth > 0 && isDry(stage, { x: p.x - 1, y: p.y }),
    bankY: depth > 0 && isDry(stage, { x: p.x, y: p.y - 1 }),
    sideLeft: depth > 0 && !isFloor(stage, { x: p.x, y: p.y + 1 }),
    sideRight: depth > 0 && !isFloor(stage, { x: p.x + 1, y: p.y }),
  }
}

// 바닥 윗면에서 수면까지 화면 거리
export const surfaceRise = (depth: number) => depth * TILE.layer - WATER.lip

export const waterTone = (depth: number) => `var(--color-water-${Math.min(3, Math.max(1, depth))})`

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

export const floatShownAt = (stage: Stage, box: { x: number; y: number; level: number }) =>
  waterDepth(stage, { x: Math.round(box.x), y: Math.round(box.y) }) > 0
    ? floatShown(box.level, stage.water ?? 0)
    : null
