import { inZone } from '@/game/camera'
import { TILE, toScreen } from '@/game/iso'
import type { Zone } from '@/game/types'

const HEADROOM = TILE.layer // 칸 위에 선 큐브와 든 사다리 몫으로 위아래에 같이 두는 여유
const PAD = 0.04 // 필드 한 변에서 여백이 차지하는 비율
const BASE_MAX_TILE = 145 // 작은 화면에서 쓰는 칸 폭 상한 px
const VIEW_PER_TILE = 6 // 상한이 화면 짧은 변의 몇 분의 1인지

export type ViewBox = [number, number, number, number]

export interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface ViewSize {
  width: number
  height: number
}

// 작은 구역이 지나치게 확대되는 것을 막는 칸 폭 상한. 큰 화면에서는 함께 커진다
export const maxTile = (view: ViewSize) =>
  Math.max(BASE_MAX_TILE, Math.min(view.width, view.height) / VIEW_PER_TILE)

// 무너진 칸도 처음 높이로 세서 칸이 사라질 때 화면이 따라 움직이지 않는다
export const cameraHeights = (stage: number[][], heights: number[][]) =>
  heights.map((row, y) => row.map((h, x) => Math.max(h, stage[y][x])))

// 구역 칸이 그려지는 범위, 구역이 없으면 맵 전체
export const zoneBox = (heights: number[][], zone?: Zone): Box => {
  const blocks = heights.flatMap((row, y) =>
    row.flatMap((h, x) =>
      h >= 0 && (!zone || inZone(zone, { x, y })) ? [{ h, screen: toScreen({ x, y }, h) }] : [],
    ),
  )

  return {
    minX: Math.min(...blocks.map((b) => b.screen.x - TILE.width / 2)),
    maxX: Math.max(...blocks.map((b) => b.screen.x + TILE.width / 2)),
    minY: Math.min(...blocks.map((b) => b.screen.y - TILE.height / 2)) - HEADROOM,
    maxY:
      Math.max(...blocks.map((b) => b.screen.y + TILE.height / 2 + b.h * TILE.layer + TILE.lip)) +
      HEADROOM,
  }
}

// 구역을 화면 한가운데에 놓고 화면과 같은 비율로 만든 viewBox
export const viewBoxFor = (box: Box, view: ViewSize): ViewBox => {
  const width = box.maxX - box.minX
  const height = box.maxY - box.minY
  // 화면 크기를 아직 재지 못했으면 구역 범위를 그대로 쓴다
  if (view.width === 0 || view.height === 0) return [box.minX, box.minY, width, height]

  // 상한은 확대만 막는다. 구역이 화면보다 커서 배율이 이미 작을 때는 걸리지 않는다
  const scale = Math.min(
    (view.width * (1 - PAD * 2)) / width,
    (view.height * (1 - PAD * 2)) / height,
    maxTile(view) / TILE.width,
  )
  const vw = view.width / scale
  const vh = view.height / scale

  return [(box.minX + box.maxX - vw) / 2, (box.minY + box.maxY - vh) / 2, vw, vh]
}
