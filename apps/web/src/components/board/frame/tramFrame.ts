import { PIT_FLOOR } from '../view'
import { lerp, smooth } from './curveFrame'
import { SECONDS, same } from './pathFrame'
import {
  NO_SWAMP,
  type SwampTime,
  type TramEvent,
  elapsedAt,
  tramMoves,
  tramStart,
} from './timeFrame'
import { TILE, toScreen } from '@/game/iso'
import { nextTramSpot } from '@/game/rules'
import type { GameEvent, GameState, Point, Tram, TramSpot } from '@/game/types'

// 발판이 다음 칸으로 가는 진행도 0~1, 발판이 가지 않는 이동은 1
export const tramProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = tramStart(events)
  if (at === null) return 1

  return smooth(Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / SECONDS.tram)))
}

// 뒤쪽 칸 블록에 덮이지 않는 앞쪽 칸
export const frontOf = (a: Point, b: Point) => (a.x + a.y >= b.x + b.y ? a : b)

// 덮이는 순서가 맞게 발판과 그 위에 탄 것을 함께 그리는 칸
export const slidingCell = (from: Point, to: Point, p: number) =>
  p <= 0 ? from : p >= 1 ? to : frontOf(from, to)

// at 칸을 실어 옮기는 발판, 없으면 null
export const carryOf = (events: GameEvent[], at: Point | null) =>
  at === null ? null : (tramMoves(events).find((tram) => same(tram.from, at)) ?? null)

// 발판에 실려 간 칸 거리
export const carriedBy = (carry: TramEvent, p: number) => ({
  x: (carry.to.x - carry.from.x) * p,
  y: (carry.to.y - carry.from.y) * p,
})

export const tramNext = (tram: Tram, spot: TramSpot) =>
  tram.cells[nextTramSpot(tram.cells, spot).at]

// 코가 가리키는 다음에 갈 쪽, 끝에 닿으면 오던 쪽
export const tramFacing = (tram: Tram, spot: TramSpot) => {
  const at = tram.cells[spot.at]
  const ahead = tram.cells[spot.at + spot.dir]
  const back = tram.cells[spot.at - spot.dir]
  return ahead ? { x: ahead.x - at.x, y: ahead.y - at.y } : { x: at.x - back.x, y: at.y - back.y }
}

// 바닥이 없어도 구덩이로 그리는 발판 길 칸, 값은 이웃한 길 칸의 방향
export const railDirsOf = (trams: Tram[]) => {
  const map = new Map<string, string>()
  for (const tram of trams)
    tram.cells.forEach((cell, i) =>
      map.set(
        `${cell.x}-${cell.y}`,
        [tram.cells[i - 1], tram.cells[i + 1]]
          .filter((near) => near !== undefined)
          .map((near) => `${near.x - cell.x},${near.y - cell.y}`)
          .join('|'),
      ),
    )
  return map
}

interface TramView {
  trams: Tram[]
  before: Pick<GameState, 'trams'>
  game: Pick<GameState, 'trams'>
  tramPhase: number
  fade: number // 재시작하며 처음 자리에 다시 나타나는 진하기
}

// 이전 자리에서 다음 자리로 미끄러지는 발판, 코와 밝은 레일이 넘어가는 때는 도착 순간
export const tramFramesOf = ({ trams, before, game, tramPhase, fade }: TramView) =>
  trams.map((tram, i) => {
    const from = tram.cells[before.trams[i].at]
    const to = tram.cells[game.trams[i].at]
    const spot = tramPhase < 1 ? before.trams[i] : game.trams[i]
    const sliding = tramPhase > 0 && tramPhase < 1
    const facing = sliding ? { x: to.x - from.x, y: to.y - from.y } : tramFacing(tram, spot)
    const screen = toScreen(
      { x: lerp(from.x, to.x, tramPhase), y: lerp(from.y, to.y, tramPhase) },
      0,
    )
    return {
      x: screen.x,
      y: screen.y - tram.level * TILE.layer,
      depth: PIT_FLOOR + tram.level * TILE.layer,
      dx: facing.x,
      dy: facing.y,
      to,
      cell: slidingCell(from, to, tramPhase),
      next: tramNext(tram, spot),
      opacity: before.trams[i].at === game.trams[i].at ? 1 : fade,
    }
  })
