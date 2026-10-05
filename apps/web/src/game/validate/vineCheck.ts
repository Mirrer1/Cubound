import { type CheckContext, distance, isInt, isObject, key } from './stageCheck'

export const checkVines = ({
  data,
  grid,
  entities,
  add,
  isFloor,
  crackCells,
  vineRoots,
}: CheckContext) => {
  const vineIds = new Set<string>()
  const vineCells = new Set<string>()

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
}
