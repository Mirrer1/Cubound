import { type CheckContext, isInt, isObject } from './stageCheck'

export const checkZones = ({ data, grid, width, add }: CheckContext) => {
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
}
