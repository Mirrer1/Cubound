import { inZone } from '@/game/camera'
import { TILE, toScreen } from '@/game/iso'
import type { Point, Zone } from '@/game/types'

const HEADROOM = TILE.layer // 칸 위에 선 큐브와 든 사다리 몫으로 위아래에 두는 여유
const PAD = 0.04 // 필드 한 변에서 여백이 차지하는 비율
const BASE_MAX_TILE = 145 // 작은 화면에서 쓰는 칸 폭 상한 px
const MIN_TILE = 48 // 칸 폭 하한 px
const VIEW_PER_TILE = 6 // 상한이 화면 짧은 변의 몇 분의 1인지 나타내는 값
const SMALL_VIEW_WIDTH = 600 // 폰 세로만 드는 필드 폭 px
const WHOLE_TILE = 88 // 처음부터 판 전체를 보여 주는 판 전체 칸 폭 하한 px

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

// 작은 구역의 과한 확대를 막는 칸 폭 상한, 큰 화면에서는 함께 커지는 값
export const maxTile = (view: ViewSize) =>
  Math.max(BASE_MAX_TILE, Math.min(view.width, view.height) / VIEW_PER_TILE)

export const isSmallView = (view: ViewSize) => view.width > 0 && view.width < SMALL_VIEW_WIDTH

// 작은 화면에서 확대해 보이는 칸 폭 하한
export const minTileFor = (view: ViewSize, zoomTile: number) =>
  isSmallView(view) ? zoomTile : MIN_TILE

// 무너진 칸도 처음 높이로 센 높이, 칸이 사라질 때 화면이 따라 움직이지 않는 이유
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

// 구역이 담기면 가운데, 넘치면 비출 자리를 따라가다 구역 가장자리에서 멈추는 자리
const place = (min: number, max: number, size: number, look: number) =>
  size >= max - min ? (min + max - size) / 2 : Math.min(Math.max(look - size / 2, min), max - size)

// 구역을 화면 한가운데에 놓고 화면과 같은 비율로 만든 viewBox, look은 구역이 화면보다 클 때 비출 화면 좌표
export const viewBoxFor = (box: Box, view: ViewSize, look?: Point, minTile = MIN_TILE): ViewBox => {
  const width = box.maxX - box.minX
  const height = box.maxY - box.minY
  // 화면 크기를 아직 재지 못했을 때의 구역 범위
  if (view.width === 0 || view.height === 0) return [box.minX, box.minY, width, height]

  // 확대만 막는 상한, 구역이 화면보다 커서 배율이 이미 작을 때는 무관
  const fit = Math.min(
    (view.width * (1 - PAD * 2)) / width,
    (view.height * (1 - PAD * 2)) / height,
    maxTile(view) / TILE.width,
  )
  // 화면 크기를 따라 키우지 않는 하한, 넓은 화면은 칸이 이미 커서 무관
  const scale = Math.max(fit, minTile / TILE.width)
  const vw = view.width / scale
  const vh = view.height / scale
  const at = look ?? { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }

  return [place(box.minX, box.maxX, vw, at.x), place(box.minY, box.maxY, vh, at.y), vw, vh]
}

// 화면 가운데와 배율, 판 크기가 바뀌어도 보이는 자리와 크기가 이어지는 보간 단위
export interface Cam {
  x: number
  y: number
  scale: number
}

export const camOf = ([vx, vy, vw, vh]: ViewBox, view: ViewSize): Cam => ({
  x: vx + vw / 2,
  y: vy + vh / 2,
  scale: view.width / vw,
})

export const viewBoxOfCam = ({ x, y, scale }: Cam, view: ViewSize): ViewBox => {
  const vw = view.width / scale
  const vh = view.height / scale
  return [x - vw / 2, y - vh / 2, vw, vh]
}

export const lerpCam = (a: Cam, b: Cam, p: number): Cam => ({
  x: a.x + (b.x - a.x) * p,
  y: a.y + (b.y - a.y) * p,
  scale: a.scale + (b.scale - a.scale) * p,
})

// viewBox 안에 범위가 다 들어오는 경우, 판 전체가 이미 보여 전체 보기가 필요 없는 화면
export const coversBox = ([vx, vy, vw, vh]: ViewBox, box: Box) =>
  box.minX >= vx - 1 && box.maxX <= vx + vw + 1 && box.minY >= vy - 1 && box.maxY <= vy + vh + 1

const tileFor = (box: Box, view: ViewSize, minTile: number) =>
  (TILE.width * view.width) / viewBoxFor(box, view, undefined, minTile)[2]

// 평소 화면의 범위, 판 전체 칸이 충분히 크거나 어느 구역 화면보다 작아지지 않으면 판 전체
// 판정 기준은 플레이 중 변하지 않는 처음 판 높이 base
export const homeBox = (
  base: number[][],
  heights: number[][],
  zones: Zone[],
  index: number,
  view: ViewSize,
  minTile: number,
): Box => {
  if (zones.length === 0) return zoneBox(heights)
  if (view.width === 0 || view.height === 0) return zoneBox(heights, zones[index])

  const whole = tileFor(zoneBox(base), view, 0)
  const showsWhole =
    whole >= Math.max(WHOLE_TILE, minTile) ||
    zones.every((zone) => whole >= tileFor(zoneBox(base, zone), view, minTile))
  return showsWhole ? zoneBox(heights) : zoneBox(heights, zones[index])
}
