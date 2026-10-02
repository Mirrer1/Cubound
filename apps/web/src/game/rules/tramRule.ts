import type { GameEvent, GameState, MoveResult, Point, Stage, Tram, TramSpot } from '../types'
import { same } from './cellRule'

export const trams = (stage: Stage) => stage.entities.filter((e): e is Tram => e.type === 'tram')

const tramAt = (state: GameState, p: Point): Tram | null => {
  if (state.trams.length === 0) return null

  return trams(state.stage).find((tram, i) => same(tram.cells[state.trams[i].at], p)) ?? null
}

export const tramLevelAt = (state: GameState, p: Point): number | null =>
  tramAt(state, p)?.level ?? null

export const onTramPath = (stage: Stage, p: Point) =>
  trams(stage).some((tram) => tram.cells.some((cell) => same(cell, p)))

// 발판이 다음 수에 갈 자리, 길 끝에서는 방향 반전
export const nextTramSpot = (cells: Point[], spot: TramSpot): TramSpot => {
  const ahead = spot.at + spot.dir
  const dir = ahead < 0 || ahead >= cells.length ? ((spot.dir * -1) as 1 | -1) : spot.dir
  return { id: spot.id, at: spot.at + dir, dir }
}

// 위에 있던 큐브와 상자도 발판과 함께 이동
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

// 다른 발판에 내려설 때만 세는 탄 횟수
export const boardsTram = (before: GameState, after: GameState) => {
  const to = tramAt(after, after.player)
  return to !== null && to !== tramAt(before, before.player)
}
