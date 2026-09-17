import type { Point } from './types'

export const TILE = { width: 104, height: 52, layer: 30, lip: 16 }

// 칸 윗면 중심의 화면 좌표
export const toScreen = ({ x, y }: Point, h: number): Point => ({
  x: ((x - y) * TILE.width) / 2,
  y: ((x + y) * TILE.height) / 2 - h * TILE.layer,
})

const points = (list: [number, number][]) => list.map(([x, y]) => `${x},${y}`).join(' ')

// 윗면 중심이 (cx, cy)이고 폭 width, 옆면 높이 depth인 블록의 세 면
export const blockFaces = (cx: number, cy: number, width: number, depth: number) => {
  const hw = width / 2
  const hh = width / 4

  return {
    top: points([
      [cx, cy - hh],
      [cx + hw, cy],
      [cx, cy + hh],
      [cx - hw, cy],
    ]),
    left: points([
      [cx - hw, cy],
      [cx, cy + hh],
      [cx, cy + hh + depth],
      [cx - hw, cy + depth],
    ]),
    right: points([
      [cx, cy + hh],
      [cx + hw, cy],
      [cx + hw, cy + depth],
      [cx, cy + hh + depth],
    ]),
  }
}
