import { WATER } from '../view'
import { clamp01, lerp, smooth } from './curveFrame'
import { same } from './pathFrame'
import { TILE } from '@/game/iso'
import { tideLeft } from '@/game/rules'
import type { GameEvent, GameState, Point } from '@/game/types'

// TIDE 숫자와 방향, 물때가 바뀌는 수의 연출 동안은 0, 밀물 판이 아니면 null
export const tideDisplay = (game: GameState | null, events: GameEvent[], animating: boolean) => {
  const tide = game ? tideLeft(game) : null
  const turning = animating && events.some((e) => e.type === 'sluice' && e.tide === true)
  return tide && { left: turning ? 0 : tide.left, up: tide.up, turning }
}

export interface TideLook {
  wet: number // 다음 수에 잠길 칸 윗면의 젖은 빛 0~1
  band: number // 다음 수에 물이 빠지는 벽 옆면의 젖은 띠 진하기 0~1
  bandLeft: boolean // 왼쪽 앞 이웃이 높은 물에 잠기는 면
  bandRight: boolean // 오른쪽 앞 이웃이 높은 물에 잠기는 면
  bandTop: number // 칸 윗면에서 띠 위 끝까지 px
  bandHeight: number // 띠 높이 px
}

export const NO_TIDE: TideLook = {
  wet: 0,
  band: 0,
  bandLeft: false,
  bandRight: false,
  bandTop: 0,
  bandHeight: 0,
}

// 밀물 직전 1, 썰물 직전 -1, 그 밖 0
const warning = (state: GameState) => {
  const tide = tideLeft(state)
  return tide?.left === 1 ? (tide.up ? 1 : -1) : 0
}

interface TideScene {
  before: GameState
  moving: boolean
  dropping: boolean
  sluice: { phase: { level: number } }
}

// 칸마다 밀물 직전 젖은 빛과 썰물 직전 젖은 띠
export const tideLookOf = (
  { before, moving, dropping, sluice }: TideScene,
  { game, t }: { game: GameState; t: number },
) => {
  const { stage, heights } = game
  if (!stage.rules?.tide) return () => NO_TIDE

  const level = sluice.phase.level
  // 그 수 전체에 걸쳐 켜지고 수면이나 재시작을 따라 꺼지는 진하기
  const shift = (from: number, to: number) =>
    from === to || (!moving && !dropping)
      ? to
      : to > from && !dropping
        ? smooth(clamp01(t))
        : lerp(from, to, level)
  const wet = shift(Math.max(warning(before), 0), Math.max(warning(game), 0))
  const band = shift(Math.max(-warning(before), 0), Math.max(-warning(game), 0))

  const water = stage.water ?? 0
  const surface = (water + 1) * TILE.layer - WATER.lip
  const flooded = (p: Point) => {
    const h = heights[p.y]?.[p.x]
    return h !== undefined && h >= 0 && h <= water
  }

  return (p: Point): TideLook => {
    const h = heights[p.y][p.x]
    const floodable = stage.heights[p.y][p.x] === water && !same(stage.goal, p)
    const top = h * TILE.layer
    const wall = top > surface
    const bandLeft = wall && flooded({ x: p.x, y: p.y + 1 })
    const bandRight = wall && flooded({ x: p.x + 1, y: p.y })
    if (!floodable && !bandLeft && !bandRight) return NO_TIDE

    const bandTop = Math.max(0, top - surface - TILE.layer)
    return {
      wet: floodable ? wet : 0,
      band: bandLeft || bandRight ? band : 0,
      bandLeft,
      bandRight,
      bandTop,
      bandHeight: top - surface - bandTop,
    }
  }
}
