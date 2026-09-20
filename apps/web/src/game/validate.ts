import type { Stage } from './types'

export const STAGE_VERSION = 1

const ENTITY_TYPES = ['box', 'switch', 'door', 'lift', 'warp', 'ladder']
const GUIDE_TARGETS = ['restart', 'moves', 'pushes']
const MAX_GUIDES = 3

export type ValidateResult = { ok: true; stage: Stage } | { ok: false; errors: string[] }

type Data = Record<string, unknown>

const isObject = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isInt = (value: unknown): value is number => Number.isInteger(value)

// 공식 스테이지와 유저가 공유한 맵을 같은 기준으로 검사한다
export const validateStage = (data: unknown): ValidateResult => {
  if (!isObject(data)) return { ok: false, errors: ['스테이지가 객체가 아니다'] }

  const errors: string[] = []
  const add = (message: string) => errors.push(message)

  if (data.version !== STAGE_VERSION) add('version은 1이어야 한다')
  if (typeof data.id !== 'string' || data.id === '') add('id가 비어 있다')
  if (data.name !== undefined && typeof data.name !== 'string') add('name이 문자열이 아니다')

  const heights = data.heights
  const rows = Array.isArray(heights) ? heights : []
  if (rows.length === 0 || !Array.isArray(rows[0]) || rows[0].length === 0) {
    add('heights가 비어 있다')
    return { ok: false, errors }
  }
  if (!rows.every((row) => Array.isArray(row) && row.length === rows[0].length)) {
    add('heights의 모든 행 길이가 같아야 한다')
    return { ok: false, errors }
  }
  if (!rows.every((row: unknown[]) => row.every((h) => isInt(h) && h >= -1))) {
    add('heights 값은 -1 이상의 정수여야 한다')
  }

  const grid = rows as number[][]
  const width = grid[0].length
  const isFloor = (p: unknown): p is Data & { x: number; y: number } =>
    isObject(p) && isInt(p.x) && isInt(p.y) && (grid[p.y]?.[p.x] ?? -1) >= 0
  const key = (p: { x: number; y: number }) => `${p.x},${p.y}`

  if (data.ice !== undefined) {
    const ice = data.ice
    const shaped =
      Array.isArray(ice) &&
      ice.length === grid.length &&
      ice.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('ice는 heights와 같은 모양의 문자열 배열이어야 한다')
    else if (
      (ice as string[]).some((row, y) => [...row].some((c, x) => c === '#' && grid[y][x] < 0))
    )
      add('바닥 없는 칸에 얼음이 있다')
  }

  const crackCells = new Set<string>()
  if (data.cracks !== undefined) {
    const cracks = data.cracks
    const shaped =
      Array.isArray(cracks) &&
      cracks.length === grid.length &&
      cracks.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('cracks는 heights와 같은 모양의 문자열 배열이어야 한다')
    else {
      const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
      const cells = (cracks as string[]).flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === '.' ? [] : [{ c, x, y }])),
      )

      if (cells.some(({ c }) => c < '1' || c > '9')) add('cracks 값은 점이나 1~9여야 한다')
      if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 무너지는 칸이 있다')
      if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 무너지는 칸이 있다')

      cells.forEach(({ x, y }) => crackCells.add(key({ x, y })))
      if (isFloor(data.goal) && crackCells.has(key(data.goal))) add('goal이 무너지는 칸에 있다')
    }
  }

  if (!isFloor(data.start)) add('start가 바닥 칸이 아니다')
  if (!isFloor(data.goal)) add('goal이 바닥 칸이 아니다')
  if (isFloor(data.start) && isFloor(data.goal) && key(data.start) === key(data.goal)) {
    add('start와 goal이 같다')
  }

  const entities = Array.isArray(data.entities) ? data.entities : []
  if (!Array.isArray(data.entities)) add('entities가 배열이 아니다')

  const occupied = new Set<string>()
  const reserved = new Set([data.start, data.goal].filter(isFloor).map(key))
  // 스위치는 문과 발판을 같은 target으로 가리켜 id를 함께 관리한다
  const targetIds = new Set<string>()
  const iceRows = Array.isArray(data.ice) ? (data.ice as string[]) : []
  const warpCells = new Map<string, { x: number; y: number }[]>()

  entities.forEach((entity, i) => {
    if (!isObject(entity) || !ENTITY_TYPES.includes(entity.type as string)) {
      add(`entities[${i}]의 type을 알 수 없다`)
      return
    }
    if (!isFloor(entity)) {
      add(`entities[${i}]이 바닥 칸이 아니다`)
      return
    }
    if (occupied.has(key(entity))) add(`entities[${i}]이 다른 오브젝트와 같은 칸에 있다`)
    if (reserved.has(key(entity))) add(`entities[${i}]이 시작이나 목표 칸에 있다`)
    // 상자는 밀려 다니므로 시작 위치가 무너지는 칸이어도 된다
    if (entity.type !== 'box' && crackCells.has(key(entity))) {
      add(`entities[${i}]이 무너지는 칸에 있다`)
    }
    occupied.add(key(entity))

    if (entity.type === 'door' || entity.type === 'lift') {
      const label = entity.type === 'door' ? '문' : '발판'
      if (typeof entity.id !== 'string') add(`entities[${i}]의 ${label} id가 없다`)
      else if (targetIds.has(entity.id)) add(`${label} id ${entity.id}가 겹친다`)
      else targetIds.add(entity.id)
    }

    if (entity.type === 'warp') {
      if (typeof entity.id !== 'string' || entity.id === '') {
        add(`entities[${i}]의 짝 칸 id가 비어 있다`)
      } else {
        warpCells.set(entity.id, [
          ...(warpCells.get(entity.id) ?? []),
          { x: entity.x, y: entity.y },
        ])
      }
      if (iceRows[entity.y]?.[entity.x] === '#') add(`entities[${i}]이 얼음 칸에 있다`)
    }
  })

  warpCells.forEach((cells, id) => {
    if (targetIds.has(id)) add(`짝 칸 id ${id}가 겹친다`)
    if (cells.length !== 2) add(`짝 칸 id ${id}는 두 칸이어야 한다`)
    else if (grid[cells[0].y][cells[0].x] !== grid[cells[1].y][cells[1].x]) {
      add(`짝 칸 id ${id}의 두 칸 높이가 다르다`)
    }
  })

  entities.forEach((entity, i) => {
    if (isObject(entity) && entity.type === 'switch' && !targetIds.has(entity.target as string)) {
      add(`entities[${i}]의 target인 문이나 발판 ${String(entity.target)}가 없다`)
    }
  })

  if (data.best !== undefined && !(isInt(data.best) && data.best > 0)) {
    add('best는 양의 정수여야 한다')
  }

  if (data.rules !== undefined) {
    if (!isObject(data.rules)) add('rules가 객체가 아니다')
    else {
      const { moveLimit, pushLimit } = data.rules
      if (moveLimit !== undefined) {
        if (!(isInt(moveLimit) && moveLimit > 0)) add('rules.moveLimit은 양의 정수여야 한다')
        else if (isInt(data.best) && moveLimit < data.best) add('rules.moveLimit이 best보다 작다')
      }
      if (pushLimit !== undefined && !(isInt(pushLimit) && pushLimit > 0)) {
        add('rules.pushLimit은 양의 정수여야 한다')
      }
    }
  }

  if (data.guides !== undefined) {
    const guides = Array.isArray(data.guides) ? data.guides : []
    if (guides.length === 0 || guides.length > MAX_GUIDES) add('guides는 1~3단계여야 한다')

    guides.forEach((guide, i) => {
      if (!isObject(guide) || typeof guide.id !== 'string' || guide.id === '') {
        add(`guides[${i}]의 id가 비어 있다`)
      }
      const target = isObject(guide) ? guide.target : undefined
      if (isObject(target)) {
        const inside =
          isInt(target.x) && isInt(target.y) && grid[target.y]?.[target.x] !== undefined
        if (!inside) add(`guides[${i}]의 target이 맵 밖이다`)
      } else if (!GUIDE_TARGETS.includes(target as string)) {
        add(`guides[${i}]의 target을 알 수 없다`)
      }
    })
  }

  if (data.zones !== undefined) {
    const zones = Array.isArray(data.zones) ? data.zones : []
    const covered = new Set<string>()

    zones.forEach((zone, i) => {
      const valid =
        isObject(zone) &&
        [zone.x, zone.y, zone.w, zone.h].every(isInt) &&
        (zone.x as number) >= 0 &&
        (zone.y as number) >= 0 &&
        (zone.w as number) > 0 &&
        (zone.h as number) > 0 &&
        (zone.x as number) + (zone.w as number) <= width &&
        (zone.y as number) + (zone.h as number) <= grid.length
      if (!valid) {
        add(`zones[${i}]이 맵을 벗어난다`)
        return
      }
      for (let y = zone.y as number; y < (zone.y as number) + (zone.h as number); y++) {
        for (let x = zone.x as number; x < (zone.x as number) + (zone.w as number); x++) {
          covered.add(`${x},${y}`)
        }
      }
    })

    const uncovered = grid.some((row, y) => row.some((h, x) => h >= 0 && !covered.has(`${x},${y}`)))
    if (zones.length > 0 && uncovered) add('구역에 속하지 않은 바닥 칸이 있다')
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, stage: data as unknown as Stage }
}
