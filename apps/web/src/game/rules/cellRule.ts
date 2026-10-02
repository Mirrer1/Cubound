import type { Direction, GameState, Point } from '../types'

const OFFSETS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

export const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y

export const step = (p: Point, direction: Direction) => ({
  x: p.x + OFFSETS[direction].x,
  y: p.y + OFFSETS[direction].y,
})

export const hasBox = (state: GameState, p: Point) => state.boxes.some((box) => same(box, p))

export const isWater = (state: GameState, { x, y }: Point) => {
  const h = state.stage.heights[y]?.[x]
  return h !== undefined && h >= 0 && h < (state.stage.water ?? 0)
}
