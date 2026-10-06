import type { Direction, GameState, Point } from '../types'
import { waterLevel } from './sluiceRule'

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
  return h !== undefined && h >= 0 && h < waterLevel(state, { x, y })
}

export const hasStone = (state: GameState, p: Point) => state.stones.some((s) => same(s, p))

// 얼음 돌 둘레의 물 칸, 소용돌이 판정은 whirlpoolRule과의 순환 탓에 엔티티 칸 기준
export const isFrozen = (state: GameState, p: Point) =>
  isWater(state, p) &&
  !state.stage.entities.some((e) => e.type === 'whirlpool' && same(e, p)) &&
  state.stones.some((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) === 1)

export const isOpenWater = (state: GameState, p: Point) => isWater(state, p) && !isFrozen(state, p)

// 언 칸 위에 밀려 올라선 상자, 언 칸의 나머지 상자는 얼어붙은 배
export const isIced = (state: GameState, p: Point) => state.iced.some((q) => same(q, p))
