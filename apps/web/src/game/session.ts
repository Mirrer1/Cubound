import { SEED_WAIT, STRUGGLES, readCracks, readMushrooms, readSwamps } from './rules'
import type {
  Carried,
  Crack,
  Direction,
  GameState,
  LeaningLadder,
  PlantedSeed,
  Point,
  Stage,
  TramSpot,
  VineSpot,
} from './types'

export const SESSION_VERSION = 7

export interface Session {
  version: typeof SESSION_VERSION
  stageId: string
  heights: number[][] // 상자와 덩굴로 메운 칸, 무너진 칸, 씨앗으로 솟은 칸이 반영된 높이
  boxes: Point[]
  tethered?: Point[] // 예전 저장에는 없는 값
  cracks: Crack[]
  trams: TramSpot[]
  swamps?: Point[] // 예전 저장에는 없는 값
  mushrooms?: Point[] // 예전 저장에는 없는 값
  vines?: VineSpot[] // 예전 저장에는 없는 값
  struggles?: number // 예전 저장에는 없는 값
  sinks?: number // 예전 저장에는 없는 값
  ladders: Point[]
  leaningLadders: LeaningLadder[]
  seeds?: Point[] // 예전 저장에는 없는 값
  planted?: PlantedSeed[] // 예전 저장에는 없는 값
  carrying: Carried | null // 예전 저장은 사다리를 들었는지만 담은 참과 거짓
  player: Point
  moves: number
  pushes: number
  climbs: number
  rides?: number // 예전 저장에는 없는 값
  dirUses?: number // 예전 저장에는 없는 값
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
  tethered: game.tethered,
  cracks: game.cracks,
  trams: game.trams,
  swamps: game.swamps,
  mushrooms: game.mushrooms,
  vines: game.vines,
  struggles: game.struggles,
  sinks: game.sinks,
  ladders: game.ladders,
  leaningLadders: game.leaningLadders,
  seeds: game.seeds,
  planted: game.planted,
  carrying: game.carrying,
  player: game.player,
  moves: game.moves,
  pushes: game.pushes,
  climbs: game.climbs,
  rides: game.rides,
  dirUses: game.dirUses,
})

// 스테이지 데이터가 바뀌었거나 값이 깨졌으면 처음부터 시작하는 null
export const restoreSession = (saved: unknown, stage: Stage): GameState | null => {
  if (!isObject(saved) || saved.version !== SESSION_VERSION || saved.stageId !== stage.id) {
    return null
  }

  const cracks = readCracks(stage)
  const savedCracks = saved.cracks
  // 줄기만 하는 남은 횟수, -1은 이미 무너진 칸
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

  const swamps = readSwamps(stage)
  const swampKeys = new Set(swamps.map(({ x, y }) => `${x},${y}`))
  const savedSwamps = saved.swamps
  // 상자가 가라앉으면 빠지기만 하는 늪 칸
  const sameSwamps =
    savedSwamps === undefined ||
    (Array.isArray(savedSwamps) &&
      savedSwamps.length <= swamps.length &&
      savedSwamps.every((value) => isObject(value) && swampKeys.has(`${value.x},${value.y}`)))
  if (!sameSwamps) return null

  const mushrooms = readMushrooms(stage)
  const mushroomKeys = new Set(mushrooms.map(({ x, y }) => `${x},${y}`))
  const savedMushrooms = saved.mushrooms
  // 시들어 빠지기만 하는 밟힌 버섯
  const sameMushrooms =
    savedMushrooms === undefined ||
    (Array.isArray(savedMushrooms) &&
      savedMushrooms.length <= mushrooms.length &&
      savedMushrooms.every((value) => isObject(value) && mushroomKeys.has(`${value.x},${value.y}`)))
  if (!sameMushrooms) return null

  const stageVines = stage.entities.filter((e) => e.type === 'vine')
  const savedVines = saved.vines
  const sameVines =
    savedVines === undefined ||
    (Array.isArray(savedVines) &&
      savedVines.length === stageVines.length &&
      stageVines.every((vine, i) => {
        const value = savedVines[i]
        return (
          isObject(value) &&
          value.id === vine.id &&
          isCount(value.grown) &&
          (value.grown as number) <= vine.cells.length &&
          typeof value.stopped === 'boolean'
        )
      }))
  if (!sameVines) return null

  const sinks = saved.sinks === undefined ? 0 : saved.sinks
  if (!isCount(sinks)) return null
  // 깊어지는 늪은 빠진 횟수만큼 느는 버둥
  const struggles = saved.struggles
  const mostStruggles = STRUGGLES + (sinks as number)
  if (struggles !== undefined && !(isCount(struggles) && (struggles as number) <= mostStruggles)) {
    return null
  }

  const crackKeys = new Set(cracks.map(({ x, y }) => `${x},${y}`))
  const seedCount = countOf(stage, 'seed')
  const rows = saved.heights
  const sameShape =
    Array.isArray(rows) &&
    rows.length === stage.heights.length &&
    rows.every(
      (row, y) =>
        Array.isArray(row) &&
        row.length === stage.heights[y].length &&
        // 스테이지 높이와 달라질 수 있는 칸, 메운 칸과 무너진 칸과 씨앗으로 솟은 칸
        row.every(
          (h, x) =>
            h === stage.heights[y][x] ||
            (stage.heights[y][x] < 0 && isCount(h)) ||
            (crackKeys.has(`${x},${y}`) && (h === -1 || isCount(h))) ||
            (seedCount > 0 && isCount(h) && h > stage.heights[y][x]),
        ),
    )
  if (!sameShape) return null

  const heights = rows as number[][]
  // 발판이 선 칸은 바닥이 없어도 설 수 있는 칸
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
  // 콩나무가 아니면 한 번 솟고 끝나 늘 0인 층
  const mostRises = stage.rules?.seedGrow ? 2 : 0
  const isPlanted = (value: unknown): value is PlantedSeed => {
    if (!onFloor(value)) return false
    const { left, rises } = value as PlantedSeed
    return isCount(left) && left >= 1 && left <= SEED_WAIT && isCount(rises) && rises <= mostRises
  }
  const seeds =
    saved.seeds === undefined
      ? stage.entities.filter((e) => e.type === 'seed').map(({ x, y }) => ({ x, y }))
      : listOf<Point>(saved.seeds, onFloor, seedCount)
  const planted = saved.planted === undefined ? [] : listOf(saved.planted, isPlanted, seedCount)
  const carrying: unknown =
    saved.carrying === true ? 'ladder' : saved.carrying === false ? null : saved.carrying

  const stagePosts = stage.entities.filter((e) => e.type === 'post')
  const tethered =
    saved.tethered === undefined
      ? stagePosts.map(({ boat }) => ({ x: boat.x, y: boat.y }))
      : listOf<Point>(saved.tethered, onFloor, stagePosts.length)

  if (!boxes || !ladders || !leaningLadders || !seeds || !planted || !tethered) return null
  const tiedToBox = (boat: Point) => boxes.some(({ x, y }) => x === boat.x && y === boat.y)
  if (tethered.length !== stagePosts.length || !tethered.every(tiedToBox)) return null
  if (carrying !== null && carrying !== 'ladder' && carrying !== 'seed') return null
  const holds = (item: Carried) => (carrying === item ? 1 : 0)
  if (ladders.length + leaningLadders.length + holds('ladder') > ladderCount) return null
  if (seeds.length + planted.length + holds('seed') > seedCount) return null
  if (!isCount(saved.moves) || !isCount(saved.pushes) || !isCount(saved.climbs)) return null
  if (saved.rides !== undefined && !isCount(saved.rides)) return null
  if (saved.dirUses !== undefined && !isCount(saved.dirUses)) return null
  if (!onFloor(saved.player)) return null

  return {
    stage,
    heights,
    boxes: boxes.map(({ x, y }) => ({ x, y })),
    tethered: tethered.map(({ x, y }) => ({ x, y })),
    cracks: (savedCracks as Crack[]).map(({ x, y, left }) => ({ x, y, left })),
    trams: (savedTrams as TramSpot[]).map(({ id, at, dir }) => ({ id, at, dir })),
    swamps:
      savedSwamps === undefined ? swamps : (savedSwamps as Point[]).map(({ x, y }) => ({ x, y })),
    mushrooms:
      savedMushrooms === undefined
        ? mushrooms
        : (savedMushrooms as Point[]).map(({ x, y }) => ({ x, y })),
    vines:
      savedVines === undefined
        ? stageVines.map(({ id }) => ({ id, grown: 0, stopped: false }))
        : (savedVines as VineSpot[]).map(({ id, grown, stopped }) => ({ id, grown, stopped })),
    struggles: (struggles as number) ?? 0,
    sinks: sinks as number,
    ladders: ladders.map(({ x, y }) => ({ x, y })),
    leaningLadders: leaningLadders.map(({ x, y, direction }) => ({ x, y, direction })),
    seeds: seeds.map(({ x, y }) => ({ x, y })),
    planted: planted.map(({ x, y, left, rises }) => ({ x, y, left, rises })),
    carrying: carrying as Carried | null,
    player: { x: saved.player.x, y: saved.player.y },
    moves: saved.moves as number,
    pushes: saved.pushes as number,
    climbs: saved.climbs as number,
    rides: (saved.rides as number) ?? 0,
    dirUses: (saved.dirUses as number) ?? 0,
    cleared: false,
  }
}
