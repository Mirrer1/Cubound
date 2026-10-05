export const STAGE_VERSION = 1

export type Data = Record<string, unknown>

type Cell = { x: number; y: number }

export type CheckContext = {
  data: Data
  grid: number[][]
  width: number
  entities: unknown[]
  add: (message: string) => void
  isFloor: (p: unknown) => p is Data & Cell
  isWaterCell: (p: Cell) => boolean
  crackCells: Set<string>
  swampCells: Set<string>
  mushroomCells: Set<string>
  vineRoots: Set<string>
  // 문과 발판을 같은 target으로 가리키는 스위치, 함께 관리하는 id
  targetIds: Set<string>
}

export const isObject = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isInt = (value: unknown): value is number => Number.isInteger(value)

export const key = (p: { x: number; y: number }) => `${p.x},${p.y}`

export const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

// 판 모양 검사, heights가 비었거나 직사각형이 아니면 undefined
export const stageContext = (
  data: Data,
  add: (message: string) => void,
): CheckContext | undefined => {
  if (data.version !== STAGE_VERSION) add('version은 1이어야 한다')
  if (typeof data.id !== 'string' || data.id === '') add('id가 비어 있다')
  if (data.name !== undefined && typeof data.name !== 'string') add('name이 문자열이 아니다')

  const heights = data.heights
  const rows = Array.isArray(heights) ? heights : []
  if (rows.length === 0 || !Array.isArray(rows[0]) || rows[0].length === 0) {
    add('heights가 비어 있다')
    return undefined
  }
  if (!rows.every((row) => Array.isArray(row) && row.length === rows[0].length)) {
    add('heights의 모든 행 길이가 같아야 한다')
    return undefined
  }
  if (!rows.every((row: unknown[]) => row.every((h) => isInt(h) && h >= -1))) {
    add('heights 값은 -1 이상의 정수여야 한다')
  }

  const grid = rows as number[][]
  const width = grid[0].length
  const isFloor = (p: unknown): p is Data & { x: number; y: number } =>
    isObject(p) && isInt(p.x) && isInt(p.y) && (grid[p.y]?.[p.x] ?? -1) >= 0
  const waterLevel = isInt(data.water) ? data.water : 0
  const isWaterCell = ({ x, y }: { x: number; y: number }) =>
    grid[y][x] >= 0 && grid[y][x] < waterLevel
  const entities = Array.isArray(data.entities) ? data.entities : []

  return {
    data,
    grid,
    width,
    entities,
    add,
    isFloor,
    isWaterCell,
    crackCells: new Set<string>(),
    swampCells: new Set<string>(),
    mushroomCells: new Set<string>(),
    vineRoots: new Set<string>(),
    targetIds: new Set<string>(),
  }
}

export const checkStartGoal = ({ data, add, isFloor }: CheckContext) => {
  if (!isFloor(data.start)) add('start가 바닥 칸이 아니다')
  if (!isFloor(data.goal)) add('goal이 바닥 칸이 아니다')
  if (isFloor(data.start) && isFloor(data.goal) && key(data.start) === key(data.goal)) {
    add('start와 goal이 같다')
  }

  if (!Array.isArray(data.entities)) add('entities가 배열이 아니다')
}

export const checkBest = ({ data, add }: CheckContext) => {
  if (data.best !== undefined && !(isInt(data.best) && data.best > 0)) {
    add('best는 양의 정수여야 한다')
  }
}
