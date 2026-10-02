import { type TopTilt, tiltOnTop } from '../view'
import type { CubeFrame } from './cubeFrame'
import { type Chain, clamp01 } from './curveFrame'
import { LADDER_SECONDS, NO_SWAMP, type SwampTime, elapsedAt, pickUpAt } from './timeFrame'
import { windLeaning } from './windFrame'
import { TILE } from '@/game/iso'
import type { GameEvent, GameState, Point } from '@/game/types'

// 구를 때 머리 위 물건의 가장 큰 기울기 라디안, 그 기울기가 풀리는 구르기 몫, 튀어 오르는 높이 px
const CARRY_LEAN = { max: 0.31, until: 0.6 }

const CARRY_HOP = { alone: 6, chained: 3, from: 0.3 }

// 윗면을 따라 기울었다 풀리며 떠올랐다 새 윗면에 앉는 머리 위 물건, 두 움직임 모두 정지에서 시작과 끝
export const carriedRoll = (p: number, chained: boolean) => {
  const lean = Math.min(1, p / CARRY_LEAN.until)
  const q = clamp01((p - CARRY_HOP.from) / (1 - CARRY_HOP.from))
  const height = chained ? CARRY_HOP.chained : CARRY_HOP.alone
  return {
    angle: CARRY_LEAN.max * Math.sin(Math.PI * lean),
    hop: height * Math.sin(Math.PI * q) ** 2,
  }
}

// 사다리를 집어 드는 진행도 0~1, 집지 않는 이동은 이동 전체
export const pickUpProgress = (events: GameEvent[], t: number, swamp: SwampTime = NO_SWAMP) => {
  const at = pickUpAt(events)
  return at === null
    ? t
    : Math.min(1, Math.max(0, (elapsedAt(events, swamp, t) - at) / LADDER_SECONDS))
}

interface CarryView {
  pickedUp: GameEvent | undefined // 이 수의 줍기
  placed: GameEvent | undefined // 이 수의 사다리 놓기
  game: Pick<GameState, 'carrying'>
  pickUpPhase: number
  ownT: number
}

export const carriedOpacityOf = ({ pickedUp, placed, game, pickUpPhase, ownT }: CarryView) =>
  pickedUp && !game.carrying
    ? 0
    : pickedUp
      ? pickUpPhase
      : placed
        ? 1 - ownT
        : game.carrying
          ? 1
          : 0

// 막힌 쪽으로 밀어 큐브가 기울면 윗면을 따라 같이 기우는 머리 위 물건
export const carriedBaseOf = (
  cubeScreen: Point,
  cubeSink: number,
  cube: Pick<CubeFrame, 'lift'>,
) => ({
  x: cubeScreen.x,
  y: cubeScreen.y - TILE.layer + cubeSink - cube.lift,
})

// 구를 때는 윗면에 붙어 같이 기울다가 새 윗면으로 살짝 튀어 앉는 물건
export const rollingTilt = (
  cube: Pick<CubeFrame, 'angle' | 'direction'>,
  chain: Chain,
): TopTilt => {
  const roll = carriedRoll(Math.min(1, cube.angle / (Math.PI / 2)), chain.in || chain.out)
  return (u, v, z) => {
    const d = tiltOnTop(cube.direction, roll.angle)(u, v, z)
    return { x: d.x, y: d.y - roll.hop }
  }
}

interface TiltView {
  events: GameEvent[]
  moving: boolean
  t: number
  swampSeconds: SwampTime
  cube: Pick<CubeFrame, 'angle' | 'direction'>
  rolling: TopTilt
}

// 막혔거나 바람에 기울면 큐브와 같은 기울기, 구르는 동안은 rolling
export const carriedTilt = ({ events, moving, t, swampSeconds, cube, rolling }: TiltView) =>
  events.some((e) => e.type === 'blocked') || (moving && windLeaning(events, t, swampSeconds))
    ? tiltOnTop(cube.direction, cube.angle)
    : moving && cube.angle > 0
      ? rolling
      : undefined

// 큐브 윗면보다 2px 위에 그리는 사다리
export const ladderTilt = (bump: TopTilt | undefined): TopTilt | undefined =>
  bump && ((u, v, z) => bump(u, v, z + 2))
