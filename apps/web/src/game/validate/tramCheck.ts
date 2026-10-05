import { type CheckContext, distance, isInt, isObject, key } from './stageCheck'

export const checkTrams = ({ grid, entities, add, targetIds }: CheckContext) => {
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
}
