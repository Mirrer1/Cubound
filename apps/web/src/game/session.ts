import { readCracks } from './rules'
import type { Crack, Direction, GameState, LeaningLadder, Point, Stage, TramSpot } from './types'

export const SESSION_VERSION = 7

export interface Session {
  version: typeof SESSION_VERSION
  stageId: string
  heights: number[][] // 상자로 메운 칸이 반영된 높이
  boxes: Point[]
  cracks: Crack[]
  trams: TramSpot[]
  ladders: Point[]
  leaningLadders: LeaningLadder[]
  carrying: boolean
  player: Point
  moves: number
  pushes: number
  climbs: number
  rides?: number // 전에 저장된 것에는 없다
  dirUses?: number // 전에 저장된 것에는 없다
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
  cracks: game.cracks,
  trams: game.trams,
  ladders: game.ladders,
  leaningLadders: game.leaningLadders,
  carrying: game.carrying,
  player: game.player,
  moves: game.moves,
  pushes: game.pushes,
  climbs: game.climbs,
  rides: game.rides,
  dirUses: game.dirUses,
})

// 스테이지 데이터가 바뀌었거나 값이 깨졌으면 처음부터 시작하도록 null을 돌려준다
export const restoreSession = (saved: unknown, stage: Stage): GameState | null => {
  if (!isObject(saved) || saved.version !== SESSION_VERSION || saved.stageId !== stage.id) {
    return null
  }

  const cracks = readCracks(stage)
  const savedCracks = saved.cracks
  // 남은 횟수는 줄기만 하고 -1은 이미 무너진 칸이다
  const sameCracks =
    Array.isArray(savedCracks) &&
    savedCracks.length === cracks.length &&
    cracks.every((crack, i) => {
      const value = savedCracks[i]
      return (
        isObject(value) &&
        value.x === crack.x &&
        value.y === crack.y &&
        Number.isInteger(value.left) &&
        (value.left as number) >= -1 &&
        (value.left as number) <= crack.left
      )
    })
  if (!sameCracks) return null

  const stageTrams = stage.entities.filter((e) => e.type === 'tram')
  const savedTrams = saved.trams
  const sameTrams =
    Array.isArray(savedTrams) &&
    savedTrams.length === stageTrams.length &&
    stageTrams.every((tram, i) => {
      const value = savedTrams[i]
      return (
        isObject(value) &&
        value.id === tram.id &&
        isCount(value.at) &&
        (value.at as number) < tram.cells.length &&
        (value.dir === 1 || value.dir === -1)
      )
    })
  if (!sameTrams) return null

  const crackKeys = new Set(cracks.map(({ x, y }) => `${x},${y}`))
  const rows = saved.heights
  const sameShape =
    Array.isArray(rows) &&
    rows.length === stage.heights.length &&
    rows.every(
      (row, y) =>
        Array.isArray(row) &&
        row.length === stage.heights[y].length &&
        // 상자로 메운 칸과 무너진 칸만 스테이지 높이와 달라질 수 있다
        row.every(
          (h, x) =>
            h === stage.heights[y][x] ||
            (stage.heights[y][x] < 0 && isCount(h)) ||
            (crackKeys.has(`${x},${y}`) && (h === -1 || isCount(h))),
        ),
    )
  if (!sameShape) return null

  const heights = rows as number[][]
  // 발판이 선 칸은 바닥이 없어도 딛고 설 수 있다
  const tramKeys = new Set(
    stageTrams.map((tram, i) => {
      const { x, y } = tram.cells[(savedTrams as TramSpot[])[i].at]
      return `${x},${y}`
    }),
  )
  const onFloor = (value: unknown): value is Point => {
    if (!isObject(value) || !Number.isInteger(value.x) || !Number.isInteger(value.y)) return false
    if (tramKeys.has(`${value.x},${value.y}`)) return true
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

  if (!boxes || !ladders || !leaningLadders) return null
  if (typeof carrying !== 'boolean') return null
  if (ladders.length + leaningLadders.length + (carrying ? 1 : 0) > ladderCount) return null
  if (!isCount(saved.moves) || !isCount(saved.pushes) || !isCount(saved.climbs)) return null
  if (saved.rides !== undefined && !isCount(saved.rides)) return null
  if (saved.dirUses !== undefined && !isCount(saved.dirUses)) return null
  if (!onFloor(saved.player)) return null

  return {
    stage,
    heights,
    boxes: boxes.map(({ x, y }) => ({ x, y })),
    cracks: (savedCracks as Crack[]).map(({ x, y, left }) => ({ x, y, left })),
    trams: (savedTrams as TramSpot[]).map(({ id, at, dir }) => ({ id, at, dir })),
    ladders: ladders.map(({ x, y }) => ({ x, y })),
    leaningLadders: leaningLadders.map(({ x, y, direction }) => ({ x, y, direction })),
    carrying,
    player: { x: saved.player.x, y: saved.player.y },
    moves: saved.moves as number,
    pushes: saved.pushes as number,
    climbs: saved.climbs as number,
    rides: (saved.rides as number) ?? 0,
    dirUses: (saved.dirUses as number) ?? 0,
    cleared: false,
  }
}
