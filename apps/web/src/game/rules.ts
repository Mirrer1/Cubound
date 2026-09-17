import type { Direction, GameState, MoveResult, Point, Stage } from './types'

const OFFSETS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

// 필드 밖과 바닥 없는 칸은 null
const heightAt = (stage: Stage, { x, y }: Point) => {
  const h = stage.heights[y]?.[x]
  return h === undefined || h < 0 ? null : h
}

export const createState = (stage: Stage): GameState => ({
  stage,
  player: stage.start,
  moves: 0,
  cleared: false,
})

export const move = (state: GameState, direction: Direction): MoveResult => {
  if (state.cleared) return { state, events: [] }

  const from = state.player
  const to = { x: from.x + OFFSETS[direction].x, y: from.y + OFFSETS[direction].y }
  const fromHeight = heightAt(state.stage, from) ?? 0
  const toHeight = heightAt(state.stage, to)

  if (toHeight === null || toHeight > fromHeight) {
    return { state, events: [{ type: 'blocked', direction }] }
  }

  const cleared = to.x === state.stage.goal.x && to.y === state.stage.goal.y
  const drop = fromHeight - toHeight

  return {
    state: { ...state, player: to, moves: state.moves + 1, cleared },
    events: [
      drop > 0 ? { type: 'fell', from, to, drop } : { type: 'moved', from, to },
      ...(cleared ? [{ type: 'cleared' } as const] : []),
    ],
  }
}
