import { type CheckContext, isObject, key } from './stageCheck'

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
  'whirlpool',
  'iceStone',
  'sluice',
]

export const checkEntities = ({
  data,
  grid,
  entities,
  add,
  isFloor,
  isWaterCell,
  crackCells,
  swampCells,
  mushroomCells,
  vineRoots,
  targetIds,
}: CheckContext) => {
  const occupied = new Set<string>()
  const reserved = new Set([data.start, data.goal].filter(isFloor).map(key))
  const iceRows = Array.isArray(data.ice) ? (data.ice as string[]) : []
  const warpCells = new Map<string, { x: number; y: number }[]>()

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
    // 밀려 다니는 상자와 얼음 돌은 무너지는 칸에서 시작해도 되는 예외
    const pushable = entity.type === 'box' || entity.type === 'iceStone'
    if (!pushable && crackCells.has(key(entity))) {
      add(`entities[${i}]이 무너지는 칸에 있다`)
    }
    if (swampCells.has(key(entity))) add(`entities[${i}]이 늪 칸에 있다`)
    if (mushroomCells.has(key(entity))) add(`entities[${i}]이 버섯 칸에 있다`)
    const wetOk = pushable || entity.type === 'whirlpool'
    if (!wetOk && isWaterCell(entity)) add(`entities[${i}]이 물 칸에 있다`)
    if (entity.type === 'whirlpool' && !isWaterCell(entity)) {
      add(`entities[${i}]의 소용돌이가 물 칸에 있지 않다`)
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
}
