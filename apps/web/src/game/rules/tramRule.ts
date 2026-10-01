import type { GameEvent, GameState, MoveResult, Point, Stage, Tram, TramSpot } from '../types'
import { same } from './cellRule'

export const trams = (stage: Stage) => stage.entities.filter((e): e is Tram => e.type === 'tram')

// 발판이 지금 서 있는 칸이면 그 발판
const tramAt = (state: GameState, p: Point): Tram | null => {
  if (state.trams.length === 0) return null

  return trams(state.stage).find((tram, i) => same(tram.cells[state.trams[i].at], p)) ?? null
}

// 발판이 지금 서 있는 칸이면 그 윗면 높이
export const tramLevelAt = (state: GameState, p: Point): number | null =>
  tramAt(state, p)?.level ?? null

// 어느 발판이든 오가는 길에 든 칸
export const onTramPath = (stage: Stage, p: Point) =>
  trams(stage).some((tram) => tram.cells.some((cell) => same(cell, p)))

// 발판이 다음 수에 갈 자리. 길 끝에 닿아 있으면 방향을 뒤집는다
export const nextTramSpot = (cells: Point[], spot: TramSpot): TramSpot => {
  const ahead = spot.at + spot.dir
  const dir = ahead < 0 || ahead >= cells.length ? ((spot.dir * -1) as 1 | -1) : spot.dir
  return { id: spot.id, at: spot.at + dir, dir }
}

// 이동 한 번마다 발판이 길을 한 칸 가고 끝에 닿으면 방향을 뒤집는다. 위에 있던 큐브와 상자는 같이 간다
export const rideTrams = (state: GameState): MoveResult => {
  if (state.trams.length === 0) return { state, events: [] }

  const events: GameEvent[] = []
  const list = trams(state.stage)
  let player = state.player
  let boxes = state.boxes

  const moved = state.trams.map((spot, i) => {
    const { cells } = list[i]
    const next = nextTramSpot(cells, spot)
    const from = { x: cells[spot.at].x, y: cells[spot.at].y }
    const to = { x: cells[next.at].x, y: cells[next.at].y }

    events.push({ type: 'tram', id: spot.id, from, to })
    if (same(player, from)) player = to
    boxes = boxes.map((box) => (same(box, from) ? to : box))

    return next
  })

  return { state: { ...state, player, boxes, trams: moved }, events }
}

// 다른 발판에 내려선 이동이면 새로 탄 것으로 센다. 타고 실려 가는 동안은 자리가 그대로라 세지 않는다
export const boardsTram = (before: GameState, after: GameState) => {
  const to = tramAt(after, after.player)
  return to !== null && to !== tramAt(before, before.player)
}
