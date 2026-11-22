import { type AmbientKind, bridgeAxis } from '../view'
import { clamp01 } from './curveFrame'
import { isNightStage, nightBeat } from '@/game/rules'
import type { GameEvent, GameState, Stage } from '@/game/types'

// 밝아질 때 큐브 되돌림과 다리 사라짐 시간, 막이 걷히는 박자
export const SHADOW_SECONDS = 0.42
// 다리가 다 사라진 뒤 다리 위 상자가 떨어져 메우는 시간
export const FALL_SECONDS = 0.3

const settles = (events: GameEvent[]) =>
  events.some((e) => e.type === 'returned' || e.type === 'shadowFilled')

// 되돌림이나 메움이 있는 수에 이동 뒤로 이어 붙는 시간, 메움은 다리가 사라진 뒤 떨어지는 몫까지
export const shadowSeconds = (events: GameEvent[]) =>
  settles(events)
    ? SHADOW_SECONDS + (events.some((e) => e.type === 'shadowFilled') ? FALL_SECONDS : 0)
    : 0

// 다리에서 빠진 상자가 아직 가라앉는 중, 그동안은 메운 바닥 대신 상자를 그림
export const sinkingNow = (sinking: boolean, sink: number) => sinking && sink < 1

// 이동이 끝난 뒤 되돌림과 다리 사라짐의 진행도 0~1
export const shadowProgress = (elapsed: number, move: number) =>
  clamp01((elapsed - move) / SHADOW_SECONDS)

// 다리가 다 사라진 뒤 상자가 떨어지는 진행도 0~1
export const fallProgress = (elapsed: number, move: number) =>
  clamp01((elapsed - move - SHADOW_SECONDS) / FALL_SECONDS)

export interface BridgeLook {
  level: number // 다리 윗면 높이
  axis: 'x' | 'y'
  parity: boolean // 칸마다 번갈아 밝은 윗면
}

// 다리 칸 열쇠마다 그릴 모습, 메운 칸도 남김
export const bridgeLooks = (stage: Stage) =>
  new Map<string, BridgeLook>(
    (stage.shadow ?? []).flatMap((row, y) =>
      [...row].flatMap((c, x) =>
        c === '.'
          ? []
          : [
              [
                `${x}-${y}`,
                {
                  level: Number(c),
                  axis: bridgeAxis(stage.shadow!, stage.heights, { x, y }),
                  parity: (x + y) % 2 === 1,
                },
              ] as const,
            ],
      ),
    ),
  )

// 어둠에 새로 앉지 않는 까마귀, 어둠 1수 전부터 새로 반짝이지 않는 짝 칸
// 짝 칸 반짝임이 어두워지는 도중에 나오면 판 둘레 빛 테두리가 잠깐 보였다 꺼짐
export const quietAmbient = (game: GameState, kind: AmbientKind) =>
  isNightStage(game.stage) &&
  ((kind === 'crow' && nightBeat(game) >= 4) || (kind === 'warp' && nightBeat(game) >= 3))
