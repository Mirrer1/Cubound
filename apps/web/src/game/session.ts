import type { Direction, GameState, LeaningLadder, Point, Stage } from './types'

export const SESSION_VERSION = 1

export interface Session {
  version: typeof SESSION_VERSION
  stageId: string
  heights: number[][] // 상자로 메운 칸이 반영된 높이
  boxes: Point[]
  ladders: Point[]
  leaningLadders: LeaningLadder[]
  carrying: boolean
  player: Point
  moves: number
}

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0

const countOf = (stage: Stage, type: string) =>
  stage.entities.filter((entity) => entity.type === type).length

export const toSession = (game: GameState): Session => ({
  version: SESSION_VERSION,
  stageId: game.stage.id,
  heights: game.heights,
  boxes: game.boxes,
  ladders: game.ladders,
  leaningLadders: game.leaningLadders,
  carrying: game.carrying,
  player: game.player,
  moves: game.moves,
})

// 스테이지 데이터가 바뀌었거나 값이 깨졌으면 처음부터 시작하도록 null을 돌려준다
export const restoreSession = (saved: unknown, stage: Stage): GameState | null => {
  if (!isObject(saved) || saved.version !== SESSION_VERSION || saved.stageId !== stage.id) {
    return null
  }

  const rows = saved.heights
  const sameShape =
    Array.isArray(rows) &&
    rows.length === stage.heights.length &&
    rows.every(
      (row, y) =>
        Array.isArray(row) &&
        row.length === stage.heights[y].length &&
        // 상자로 메운 칸만 스테이지 높이와 달라질 수 있다
        row.every((h, x) => h === stage.heights[y][x] || (stage.heights[y][x] < 0 && isCount(h))),
    )
  if (!sameShape) return null

  const heights = rows as number[][]
  const onFloor = (value: unknown): value is Point => {
    if (!isObject(value) || !Number.isInteger(value.x) || !Number.isInteger(value.y)) return false
    return (heights[value.y as number]?.[value.x as number] ?? -1) >= 0
  }
  const isLeaning = (value: unknown): value is LeaningLadder =>
    onFloor(value) && DIRECTIONS.includes((value as LeaningLadder).direction)
  const listOf = <T>(value: unknown, is: (item: unknown) => item is T, limit: number) =>
    Array.isArray(value) && value.length <= limit && value.every(is) ? (value as T[]) : null

  const boxCount = countOf(stage, 'box')
  const ladderCount = countOf(stage, 'ladder')
  const boxes = listOf<Point>(saved.boxes, onFloor, boxCount)
  const ladders = listOf<Point>(saved.ladders, onFloor, ladderCount)
  const leaningLadders = listOf<LeaningLadder>(saved.leaningLadders, isLeaning, ladderCount)
  const carrying = saved.carrying

  if (!boxes || !ladders || !leaningLadders || typeof carrying !== 'boolean') return null
  if (ladders.length + leaningLadders.length + (carrying ? 1 : 0) > ladderCount) return null
  if (!isCount(saved.moves) || !onFloor(saved.player)) return null

  return {
    stage,
    heights,
    boxes: boxes.map(({ x, y }) => ({ x, y })),
    ladders: ladders.map(({ x, y }) => ({ x, y })),
    leaningLadders: leaningLadders.map(({ x, y, direction }) => ({ x, y, direction })),
    carrying,
    player: { x: saved.player.x, y: saved.player.y },
    moves: saved.moves as number,
    cleared: false,
  }
}
