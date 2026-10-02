import type { Entity, GameEvent, GameState, MoveResult, Stage } from '../types'
import { hasBox, same } from './cellRule'

type Vine = Extract<Entity, { type: 'vine' }>

export const vines = (stage: Stage) => stage.entities.filter((e): e is Vine => e.type === 'vine')

// 앞 칸이 바닥 없는 칸일 때만 한 칸 뻗는 덩굴, 굳는 자리에서는 큐브가 딛고 선 덩굴이 정지
export const growVines = (state: GameState): MoveResult => {
  if (state.vines.length === 0) return { state, events: [] }

  const list = vines(state.stage)
  const stopping = state.stage.rules?.vineStop && !hasBox(state, state.player)
  const events: GameEvent[] = []
  let heights = state.heights

  const grown = state.vines.map((spot, i) => {
    if (spot.stopped) return spot

    const { cells } = list[i]
    if (stopping && cells.slice(0, spot.grown).some((cell) => same(cell, state.player))) {
      return { ...spot, stopped: true }
    }

    const ahead = cells[spot.grown]
    if (!ahead || heights[ahead.y][ahead.x] >= 0) return spot

    heights = heights.map((row, y) =>
      y === ahead.y ? row.map((h, x) => (x === ahead.x ? 0 : h)) : row,
    )
    events.push({ type: 'grew', id: spot.id, at: { x: ahead.x, y: ahead.y } })
    return { ...spot, grown: spot.grown + 1 }
  })

  return { state: { ...state, heights, vines: grown }, events }
}
