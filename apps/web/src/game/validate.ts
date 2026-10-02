import type { Stage } from './types'

export const STAGE_VERSION = 1

const ENTITY_TYPES = [
  'box',
  'switch',
  'door',
  'lift',
  'warp',
  'ladder',
  'tram',
  'vine',
  'seed',
  'post',
]
const GUIDE_TARGETS = ['restart', 'moves', 'pushes', 'climbs', 'rides', 'dir', 'wind']
const DIRECTIONS = ['up', 'right', 'down', 'left']
const MAX_GUIDES = 3

export type ValidateResult = { ok: true; stage: Stage } | { ok: false; errors: string[] }

type Data = Record<string, unknown>

const isObject = (value: unknown): value is Data =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isInt = (value: unknown): value is number => Number.isInteger(value)

// 공식 스테이지와 유저가 공유한 맵의 같은 검사 기준
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
  const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y)

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

  const swampCells = new Set<string>()
  if (data.swamp !== undefined) {
    const swamp = data.swamp
    const shaped =
      Array.isArray(swamp) &&
      swamp.length === grid.length &&
      swamp.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('swamp는 heights와 같은 모양의 문자열 배열이어야 한다')
    else {
      const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
      const cells = (swamp as string[]).flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
      )

      if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 늪이 있다')
      if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 늪이 있다')
      if (cells.some((cell) => crackCells.has(key(cell)))) add('무너지는 칸에 늪이 있다')

      cells.forEach((cell) => swampCells.add(key(cell)))
      if (isFloor(data.start) && swampCells.has(key(data.start))) add('start가 늪 칸에 있다')
      if (isFloor(data.goal) && swampCells.has(key(data.goal))) add('goal이 늪 칸에 있다')
    }
  }

  const mushroomCells = new Set<string>()
  if (data.mushroom !== undefined) {
    const mushroom = data.mushroom
    const shaped =
      Array.isArray(mushroom) &&
      mushroom.length === grid.length &&
      mushroom.every((row) => typeof row === 'string' && row.length === width)

    if (!shaped) add('mushroom은 heights와 같은 모양의 문자열 배열이어야 한다')
    else {
      const ice = Array.isArray(data.ice) ? (data.ice as string[]) : []
      const cells = (mushroom as string[]).flatMap((row, y) =>
        [...row].flatMap((c, x) => (c === '#' ? [{ x, y }] : [])),
      )

      if (cells.some(({ x, y }) => grid[y][x] < 0)) add('바닥 없는 칸에 버섯이 있다')
      if (cells.some(({ x, y }) => ice[y]?.[x] === '#')) add('얼음 칸에 버섯이 있다')
      if (cells.some((cell) => crackCells.has(key(cell)))) add('무너지는 칸에 버섯이 있다')
      if (cells.some((cell) => swampCells.has(key(cell)))) add('늪 칸에 버섯이 있다')

      cells.forEach((cell) => mushroomCells.add(key(cell)))
      if (isFloor(data.start) && mushroomCells.has(key(data.start))) add('start가 버섯 칸에 있다')
      if (isFloor(data.goal) && mushroomCells.has(key(data.goal))) add('goal이 버섯 칸에 있다')
    }
  }

  if (data.water !== undefined && !(isInt(data.water) && data.water > 0)) {
    add('water는 양의 정수여야 한다')
  }
  const waterLevel = isInt(data.water) ? data.water : 0
  const isWaterCell = ({ x, y }: { x: number; y: number }) =>
    grid[y][x] >= 0 && grid[y][x] < waterLevel

  const masks = [
    ['ice', '얼음'],
    ['swamp', '늪'],
    ['mushroom', '버섯'],
    ['cracks', '무너지는 칸'],
  ]
  masks.forEach(([field, label]) => {
    const mask = data[field]
    const wet =
      Array.isArray(mask) &&
      mask.some(
        (row, y) =>
          typeof row === 'string' &&
          y < grid.length &&
          [...row].some((c, x) => c !== '.' && x < width && isWaterCell({ x, y })),
      )
    if (wet) add(`물 칸에 ${label}이 있다`)
  })

  if (isFloor(data.start) && isWaterCell(data.start)) add('start가 물 칸에 있다')
  if (isFloor(data.goal) && isWaterCell(data.goal)) add('goal이 물 칸에 있다')

  if (!isFloor(data.start)) add('start가 바닥 칸이 아니다')
  if (!isFloor(data.goal)) add('goal이 바닥 칸이 아니다')
  if (isFloor(data.start) && isFloor(data.goal) && key(data.start) === key(data.goal)) {
    add('start와 goal이 같다')
  }

  const entities = Array.isArray(data.entities) ? data.entities : []
  if (!Array.isArray(data.entities)) add('entities가 배열이 아니다')

  const occupied = new Set<string>()
  const reserved = new Set([data.start, data.goal].filter(isFloor).map(key))
  // 문과 발판을 같은 target으로 가리키는 스위치, 함께 관리하는 id
  const targetIds = new Set<string>()
  const iceRows = Array.isArray(data.ice) ? (data.ice as string[]) : []
  const warpCells = new Map<string, { x: number; y: number }[]>()
  const tramCells = new Set<string>()

  // 발판 길을 먼저 훑는 이유, id 겹침과 길 겹침을 한 번에 잡는 순서
  entities.forEach((entity, i) => {
    if (!isObject(entity) || entity.type !== 'tram') return

    if (typeof entity.id !== 'string' || entity.id === '')
      add(`entities[${i}]의 발판 id가 비어 있다`)
    else if (targetIds.has(entity.id)) add(`발판 id ${entity.id}가 겹친다`)
    else targetIds.add(entity.id)

    if (!(isInt(entity.level) && entity.level >= 0)) {
      add(`entities[${i}]의 level은 0 이상의 정수여야 한다`)
    }
    if (entity.dir !== 1 && entity.dir !== -1) add(`entities[${i}]의 dir은 1이나 -1이어야 한다`)

    const cells = Array.isArray(entity.cells) ? entity.cells : []
    if (cells.length < 2) {
      add(`entities[${i}]의 cells는 두 칸 이상이어야 한다`)
      return
    }
    if (!cells.every((cell) => isObject(cell) && isInt(cell.x) && isInt(cell.y))) {
      add(`entities[${i}]의 cells에 칸이 아닌 값이 있다`)
      return
    }

    const path = cells as { x: number; y: number }[]
    if (path.some(({ x, y }) => grid[y]?.[x] === undefined)) {
      add(`entities[${i}]의 cells에 맵 밖 칸이 있다`)
      return
    }
    if (path.some(({ x, y }) => grid[y][x] >= 0)) {
      add(`entities[${i}]의 cells가 바닥 없는 칸이 아니다`)
    }
    if (path.some((cell, n) => n > 0 && distance(path[n - 1], cell) !== 1)) {
      add(`entities[${i}]의 cells가 이어져 있지 않다`)
    }
    if (new Set(path.map(key)).size !== path.length) {
      add(`entities[${i}]의 cells에 같은 칸이 두 번 있다`)
    }
    if (path.some((cell) => tramCells.has(key(cell)))) {
      add(`entities[${i}]의 길이 다른 발판과 겹친다`)
    }
    path.forEach((cell) => tramCells.add(key(cell)))

    const { x, y } = entity
    if (!path.some((cell) => cell.x === x && cell.y === y)) {
      add(`entities[${i}]의 시작 자리가 cells 안에 없다`)
    }
  })

  const vineIds = new Set<string>()
  const vineCells = new Set<string>()
  const vineRoots = new Set<string>()

  entities.forEach((entity, i) => {
    if (!isObject(entity) || entity.type !== 'vine') return

    if (typeof entity.id !== 'string' || entity.id === '')
      add(`entities[${i}]의 덩굴 id가 비어 있다`)
    else if (vineIds.has(entity.id)) add(`덩굴 id ${entity.id}가 겹친다`)
    else vineIds.add(entity.id)

    if (!isFloor(entity)) add(`entities[${i}]의 뿌리가 바닥 칸이 아니다`)
    else if (crackCells.has(key(entity))) add(`entities[${i}]의 뿌리가 무너지는 칸에 있다`)
    // 구멍 위의 뿌리는 가지처럼 보이는 그림이라 불가
    else if (isFloor(data.goal) && key(data.goal) === key(entity))
      add(`entities[${i}]의 뿌리에 goal이 있다`)
    else vineRoots.add(key(entity))

    const cells = Array.isArray(entity.cells) ? entity.cells : []
    if (cells.length === 0) {
      add(`entities[${i}]의 cells가 비어 있다`)
      return
    }
    if (!cells.every((cell) => isObject(cell) && isInt(cell.x) && isInt(cell.y))) {
      add(`entities[${i}]의 cells에 칸이 아닌 값이 있다`)
      return
    }

    const path = cells as { x: number; y: number }[]
    if (path.some(({ x, y }) => grid[y]?.[x] === undefined)) {
      add(`entities[${i}]의 cells에 맵 밖 칸이 있다`)
      return
    }
    if (path.some(({ x, y }) => grid[y][x] >= 0)) {
      add(`entities[${i}]의 cells가 바닥 없는 칸이 아니다`)
    }
    // 뿌리에서 시작해 한 칸씩 이어진 길
    const line = isInt(entity.x) && isInt(entity.y) ? [{ x: entity.x, y: entity.y }, ...path] : path
    if (line.some((cell, n) => n > 0 && distance(line[n - 1], cell) !== 1)) {
      add(`entities[${i}]의 cells가 이어져 있지 않다`)
    }
    if (new Set(path.map(key)).size !== path.length) {
      add(`entities[${i}]의 cells에 같은 칸이 두 번 있다`)
    }
    const turns = line.filter((cell, n) => {
      if (n < 2) return false
      const [a, b] = [line[n - 2], line[n - 1]]
      return b.x - a.x !== cell.x - b.x || b.y - a.y !== cell.y - b.y
    }).length
    if (turns > 2) add(`entities[${i}]의 cells가 세 번 이상 꺾인다`)
    if (path.some((cell) => vineCells.has(key(cell)))) {
      add(`entities[${i}]의 길이 다른 덩굴과 겹친다`)
    }
    path.forEach((cell) => vineCells.add(key(cell)))
  })

  entities.forEach((entity, i) => {
    if (!isObject(entity) || !ENTITY_TYPES.includes(entity.type as string)) {
      add(`entities[${i}]의 type을 알 수 없다`)
      return
    }
    if (entity.type === 'tram' || entity.type === 'vine') return
    if (!isFloor(entity)) {
      add(`entities[${i}]이 바닥 칸이 아니다`)
      return
    }
    if (occupied.has(key(entity))) add(`entities[${i}]이 다른 오브젝트와 같은 칸에 있다`)
    if (reserved.has(key(entity))) add(`entities[${i}]이 시작이나 목표 칸에 있다`)
    // 밀려 다니는 상자는 무너지는 칸에서 시작해도 되는 예외
    if (entity.type !== 'box' && crackCells.has(key(entity))) {
      add(`entities[${i}]이 무너지는 칸에 있다`)
    }
    if (swampCells.has(key(entity))) add(`entities[${i}]이 늪 칸에 있다`)
    if (mushroomCells.has(key(entity))) add(`entities[${i}]이 버섯 칸에 있다`)
    if (entity.type !== 'box' && isWaterCell(entity)) add(`entities[${i}]이 물 칸에 있다`)
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

    // 씨앗을 둘 수 있는 곳은 심을 수 있는 기본 바닥 칸
    if (entity.type === 'seed') {
      if (iceRows[entity.y]?.[entity.x] === '#') add(`entities[${i}]이 얼음 칸에 있다`)
      if (vineRoots.has(key(entity))) add(`entities[${i}]이 덩굴 뿌리에 있다`)
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

  const floatingBoxes = new Set(
    entities
      .filter((e) => isObject(e) && e.type === 'box' && isFloor(e) && isWaterCell(e))
      .map((e) => key(e as { x: number; y: number })),
  )
  const tetheredBoats = new Set<string>()
  entities.forEach((entity, i) => {
    if (!isObject(entity) || entity.type !== 'post') return

    if (!(isInt(entity.length) && entity.length > 0)) {
      add(`entities[${i}]의 줄 길이는 양의 정수여야 한다`)
    }
    if (isFloor(entity)) {
      const shore = [
        { x: entity.x, y: entity.y - 1 },
        { x: entity.x + 1, y: entity.y },
        { x: entity.x, y: entity.y + 1 },
        { x: entity.x - 1, y: entity.y },
      ].some((p) => isFloor(p) && isWaterCell(p))
      if (!shore) add(`entities[${i}]의 말뚝이 물가에 있지 않다`)
    }

    const boat = entity.boat
    if (!isFloor(boat) || !floatingBoxes.has(key(boat))) {
      add(`entities[${i}]의 배 자리에 물에 뜬 상자가 없다`)
      return
    }
    if (isFloor(entity) && isInt(entity.length) && distance(entity, boat) > entity.length) {
      add(`entities[${i}]의 배가 줄 길이 밖에 있다`)
    }
    if (tetheredBoats.has(key(boat))) add(`entities[${i}]의 배가 다른 말뚝에도 묶여 있다`)
    tetheredBoats.add(key(boat))
  })

  if (data.best !== undefined && !(isInt(data.best) && data.best > 0)) {
    add('best는 양의 정수여야 한다')
  }

  if (data.rules !== undefined) {
    if (!isObject(data.rules)) add('rules가 객체가 아니다')
    else {
      const { moveLimit, pushLimit, climbLimit, rideLimit, dirLimit } = data.rules
      const { swampDeepen, mushroomWither, vineStop, seedGrow, wind } = data.rules
      if (moveLimit !== undefined) {
        if (!(isInt(moveLimit) && moveLimit > 0)) add('rules.moveLimit은 양의 정수여야 한다')
        else if (isInt(data.best) && moveLimit < data.best) add('rules.moveLimit이 best보다 작다')
      }
      if (pushLimit !== undefined && !(isInt(pushLimit) && pushLimit > 0)) {
        add('rules.pushLimit은 양의 정수여야 한다')
      }
      if (climbLimit !== undefined && !(isInt(climbLimit) && climbLimit > 0)) {
        add('rules.climbLimit은 양의 정수여야 한다')
      }
      if (rideLimit !== undefined && !(isInt(rideLimit) && rideLimit > 0)) {
        add('rules.rideLimit은 양의 정수여야 한다')
      }
      if (dirLimit !== undefined) {
        const { dir, count } = isObject(dirLimit) ? dirLimit : {}
        if (typeof dir !== 'string' || !DIRECTIONS.includes(dir)) {
          add('rules.dirLimit.dir은 네 방향 중 하나여야 한다')
        }
        if (!(isInt(count) && count > 0)) add('rules.dirLimit.count는 양의 정수여야 한다')
      }
      if (swampDeepen !== undefined && typeof swampDeepen !== 'boolean') {
        add('rules.swampDeepen은 참이나 거짓이어야 한다')
      }
      if (mushroomWither !== undefined && typeof mushroomWither !== 'boolean') {
        add('rules.mushroomWither는 참이나 거짓이어야 한다')
      }
      if (vineStop !== undefined && typeof vineStop !== 'boolean') {
        add('rules.vineStop은 참이나 거짓이어야 한다')
      }
      if (seedGrow !== undefined && typeof seedGrow !== 'boolean') {
        add('rules.seedGrow는 참이나 거짓이어야 한다')
      }
      if (wind !== undefined && (typeof wind !== 'string' || !DIRECTIONS.includes(wind))) {
        add('rules.wind는 네 방향 중 하나여야 한다')
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
