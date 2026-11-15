import { describe, expect, it } from 'vitest'

import { playerFrame } from './cubeFrame'
import {
  FALL_SECONDS,
  SHADOW_SECONDS,
  bridgeLooks,
  fallProgress,
  quietAmbient,
  shadowSeconds,
  sinkingNow,
} from './shadowFrame'
import { NO_SWAMP, durationOf, moveSeconds } from './timeFrame'
import { createState, move } from '@/game/rules'
import type { Direction, GameState, Stage } from '@/game/types'

// (3,0) (4,0)이 그림자 다리 두 칸
const SHADOW: Stage = {
  version: 1,
  id: '21-99',
  heights: [
    [0, 0, 0, -1, -1, 0, 0],
    [0, 0, 0, -1, -1, 0, 0],
  ],
  shadow: ['...00..', '.......'],
  start: { x: 0, y: 0 },
  goal: { x: 6, y: 1 },
  entities: [],
}

const walk = (dirs: Direction[]) =>
  dirs.reduce<GameState>((s, d) => move(s, d).state, createState(SHADOW))

// 다리 둘째 칸에 오르는 순간 밝아져 (2,0)으로 돌아가는 수
const prev = walk(['right', 'right', 'down', 'up', 'right'])
const { state: game, events } = move(prev, 'right')

describe('shadowSeconds', () => {
  it('되돌림이 있는 수는 이동 뒤 0.3초를 더한다', () => {
    expect(events.some((e) => e.type === 'returned')).toBe(true)
    expect(shadowSeconds(events)).toBe(SHADOW_SECONDS)
    expect(shadowSeconds([])).toBe(0)
    expect(durationOf(events)).toBeCloseTo(moveSeconds(events, NO_SWAMP) + SHADOW_SECONDS)
  })
})

describe('playerFrame 되돌림', () => {
  it('이동하는 동안 다리 둘째 칸으로 가고 그 뒤 오르기 전 칸으로 미끄러진다', () => {
    const total = durationOf(events)
    const walked = moveSeconds(events, NO_SWAMP)
    const at = (seconds: number) => playerFrame(prev, game, events, seconds / total)

    expect(at(walked).x).toBeCloseTo(4)
    expect(at(walked + SHADOW_SECONDS / 2).x).toBeGreaterThan(2)
    expect(at(walked + SHADOW_SECONDS / 2).x).toBeLessThan(4)
    expect(at(total).x).toBeCloseTo(2)
    expect(at(total).cell).toEqual({ x: 2, y: 0 })
  })
})

describe('bridgeLooks', () => {
  it('다리 칸마다 높이와 축과 번갈이, 빈 칸으로 그릴 열쇠', () => {
    const looks = bridgeLooks(SHADOW)

    expect([...looks.keys()]).toEqual(['3-0', '4-0'])
    expect(looks.get('3-0')).toEqual({ level: 0, axis: 'x', parity: true })
    expect(looks.get('4-0')?.parity).toBe(false)
    expect(bridgeLooks({ ...SHADOW, shadow: undefined }).size).toBe(0)
  })
})

describe('quietAmbient', () => {
  it('어둠에만 까마귀가 새로 앉지 않는다', () => {
    const night = (moves: number) => ({ ...createState(SHADOW), moves })

    expect([2, 3, 4, 5].map((m) => quietAmbient(night(m), 'crow'))).toEqual([
      false,
      false,
      true,
      true,
    ])
    expect(quietAmbient(night(4), 'mote')).toBe(false)
  })
})

describe('sinkingNow', () => {
  it('다리에서 빠진 상자는 바닥 높이에 닿을 때까지만 상자로 그린다', () => {
    expect([sinkingNow(true, 0.5), sinkingNow(true, 1), sinkingNow(false, 0.5)]).toEqual([
      true,
      false,
      false,
    ])
  })
})

describe('fallProgress', () => {
  it('다리가 다 사라진 뒤에 상자가 떨어진다', () => {
    const move = 0.24
    expect(fallProgress(move + SHADOW_SECONDS, move)).toBeCloseTo(0)
    expect(fallProgress(move + SHADOW_SECONDS + FALL_SECONDS, move)).toBeCloseTo(1)
    expect(shadowSeconds([{ type: 'shadowFilled', at: { x: 0, y: 0 } }])).toBe(
      SHADOW_SECONDS + FALL_SECONDS,
    )
  })
})
