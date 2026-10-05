import { type CheckContext, distance, isInt, isObject, key } from './stageCheck'

export const checkTethers = ({ entities, add, isFloor, isWaterCell }: CheckContext) => {
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
}
