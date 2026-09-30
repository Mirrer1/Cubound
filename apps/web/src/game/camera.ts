import type { Point, Zone } from './types'

export const inZone = (zone: Zone, { x, y }: Point) =>
  x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h

// 지금 구역에 있으면 유지하고 벗어나면 들어선 구역으로 바꾸며 메운 구덩이처럼 어느 구역에도 없는 칸이면 지금 구역에 머문다
export const zoneIndexAt = (zones: Zone[], player: Point, current: number) => {
  if (zones[current] && inZone(zones[current], player)) return current
  const entered = zones.findIndex((zone) => inZone(zone, player))
  return entered >= 0 ? entered : zones[current] ? current : 0
}
