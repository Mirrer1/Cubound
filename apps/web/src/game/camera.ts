import type { Point, Zone } from './types'

export const inZone = (zone: Zone, { x, y }: Point) =>
  x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h

// 지금 구역 안이면 유지, 벗어나면 들어선 구역, 어느 구역에도 없는 칸이면 지금 구역
export const zoneIndexAt = (zones: Zone[], player: Point, current: number) => {
  if (zones[current] && inZone(zones[current], player)) return current
  const entered = zones.findIndex((zone) => inZone(zone, player))
  return entered >= 0 ? entered : zones[current] ? current : 0
}
