import type { Point, Zone } from './types'

const contains = (zone: Zone, { x, y }: Point) =>
  x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h

// 지금 구역에 있으면 유지하고 벗어나면 큐브가 들어선 구역으로 바꾼다
export const zoneIndexAt = (zones: Zone[], player: Point, current: number) => {
  if (zones[current] && contains(zones[current], player)) return current
  return Math.max(
    0,
    zones.findIndex((zone) => contains(zone, player)),
  )
}
