import type { GameEvent, GameState, Lifted, MoveResult, Point } from '../types'
import { hasBox, same, step } from './cellRule'
import { isIce } from './iceRule'
import { isMushroom } from './mushroomRule'
import { isSwamp } from './swampRule'
import { onTramPath } from './tramRule'

// 심은 씨앗이 솟기까지 드는 수
export const SEED_WAIT = 4

export const isPlanted = (state: GameState, p: Point) => state.planted.some((seed) => same(seed, p))

// 아무것도 없는 기본 바닥 칸. 스테이지에서 구덩이였던 칸은 메워져도 제외된다
export const canPlant = (state: GameState, p: Point) => {
  const { stage } = state
  return (
    stage.heights[p.y][p.x] >= 0 &&
    !isIce(state, p) &&
    !isSwamp(state, p) &&
    !isMushroom(state, p) &&
    !state.cracks.some((crack) => same(crack, p)) &&
    !onTramPath(stage, p) &&
    !same(p, stage.goal) &&
    !stage.entities.some(
      (e) => ['switch', 'door', 'lift', 'warp', 'vine'].includes(e.type) && same(e, p),
    ) &&
    !state.ladders.some((l) => same(l, p)) &&
    !state.leaningLadders.some((l) => same(l, p) || same(step(l, l.direction), p)) &&
    !state.seeds.some((s) => same(s, p)) &&
    !isPlanted(state, p)
  )
}

// 심은 씨앗은 센 수마다 남은 수가 줄고 다 되면 칸이 한 층 솟는다. 위의 큐브와 상자는 높이를 따라 같이 오른다
export const riseSeeds = (before: GameState, state: GameState): MoveResult => {
  if (state.planted.length === 0) return { state, events: [] }

  const events: GameEvent[] = []
  let heights = state.heights

  const planted = state.planted.flatMap((seed) => {
    // 이번 수에 심은 씨앗은 세지 않는다
    if (!isPlanted(before, seed)) return [seed]

    const { x, y } = seed
    const left = seed.left - 1
    if (left > 0) {
      events.push({ type: 'seedTicked', at: { x, y }, left })
      return [{ ...seed, left }]
    }

    const height = heights[y][x] + 1
    heights = heights.map((row, i) => (i === y ? row.map((h, j) => (j === x ? height : h)) : row))
    const rises = seed.rises + 1
    // 콩나무는 세 층까지 솟는다
    const growing = Boolean(state.stage.rules?.seedGrow) && rises < 3
    const lifted: Lifted[] = [
      ...(hasBox(state, seed) ? ['box' as const] : []),
      ...(same(state.player, seed) ? ['player' as const] : []),
    ]
    events.push({ type: 'rose', at: { x, y }, height, lifted, growing })
    return growing ? [{ x, y, left: SEED_WAIT, rises }] : []
  })

  return { state: { ...state, heights, planted }, events }
}
