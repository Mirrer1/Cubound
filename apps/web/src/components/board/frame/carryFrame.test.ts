import { describe, expect, it } from 'vitest'

import { tiltOnTop } from '../view'
import {
  carriedBaseOf,
  carriedOpacityOf,
  carriedRoll,
  carriedTilt,
  ladderTilt,
  pickUpProgress,
  rollingTilt,
} from './carryFrame'
import { playerFrame } from './cubeFrame'
import { swampTime } from './swampFrame'
import { STAGE, gust } from './testStages'
import { durationOf } from './timeFrame'
import { TILE } from '@/game/iso'
import { createState, move } from '@/game/rules'
import type { GameEvent, Stage } from '@/game/types'

// 얼음을 타고 여러 칸 미끄러져 사다리가 놓인 칸에 멈추는 판
const LADDER_ICE_STAGE: Stage = {
  version: 1,
  id: 'test-ladder-ice',
  name: '미끄러지는 사다리',
  heights: [[0, 0, 0, 0, 0, 0]],
  ice: ['.###..'],
  start: { x: 0, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'ladder', x: 4, y: 0 }],
}

describe('pickUpProgress', () => {
  const slideToLadder = () => {
    const prev = createState(LADDER_ICE_STAGE)
    return { prev, ...move(prev, 'right') }
  }

  it('미끄러져 도착하기 전에는 사다리가 그대로다', () => {
    const { prev, state, events } = slideToLadder()

    expect(state.carrying).toBe('ladder')
    for (let t = 0; t <= 1; t += 0.02) {
      if (playerFrame(prev, state, events, t).x < state.player.x) {
        expect(pickUpProgress(events, t)).toBe(0)
      }
    }
  })

  it('도착한 뒤에 사라지기 시작해 이동이 끝나면 다 사라진다', () => {
    const { prev, state, events } = slideToLadder()
    let started = 0
    let last = 0
    for (let t = 0; t <= 1; t += 0.02) {
      const progress = pickUpProgress(events, t)
      expect(progress).toBeGreaterThanOrEqual(last)
      if (progress > 0 && started === 0) started = t
      last = progress
    }

    expect(playerFrame(prev, state, events, started).x).toBeCloseTo(state.player.x)
    expect(pickUpProgress(events, 1)).toBeCloseTo(1)
  })

  it('사다리가 없는 이동은 값이 그대로다', () => {
    const bare: Stage = { ...LADDER_ICE_STAGE, entities: [] }
    const { events } = move(createState(bare), 'right')

    expect(pickUpProgress(events, 0.3)).toBeCloseTo(0.3)
    expect(durationOf(events)).toBeLessThan(durationOf(slideToLadder().events))
  })
})

describe('carriedRoll', () => {
  it('구르기 앞쪽에 윗면을 따라 기울었다가 떠오른 동안 반듯해진다', () => {
    expect(carriedRoll(0, false)).toEqual({ angle: 0, hop: 0 })
    expect(carriedRoll(0.3, false).angle).toBeCloseTo(0.31)
    expect(carriedRoll(0.6, false).angle).toBeCloseTo(0)
    expect(carriedRoll(0.2, false).hop).toBe(0)
  })

  it('가운데 뒤에서 가장 높이 떴다가 끝에 새 윗면에 앉는다', () => {
    expect(carriedRoll(0.65, false).hop).toBeCloseTo(6)
    expect(carriedRoll(1, false).hop).toBeCloseTo(0)
    expect(carriedRoll(1, false).angle).toBeCloseTo(0)
  })

  it('연달아 구르는 동안에는 절반 높이로 튄다', () => {
    expect(carriedRoll(0.65, true).hop).toBeCloseTo(3)
  })
})

describe('머리 위 물건', () => {
  const PICKED: GameEvent = { type: 'pickedUp', at: { x: 1, y: 0 }, item: 'ladder' }
  const PLACED: GameEvent = { type: 'placed', ladder: { x: 1, y: 0, direction: 'right' } }
  const carry = (view: Partial<Parameters<typeof carriedOpacityOf>[0]>) =>
    carriedOpacityOf({
      pickedUp: undefined,
      placed: undefined,
      game: { carrying: null },
      pickUpPhase: 0.3,
      ownT: 0.4,
      ...view,
    })

  it('carriedOpacityOf는 줍는 수에 줍는 진행도만큼 나타난다', () => {
    expect(carry({ pickedUp: PICKED, game: { carrying: 'ladder' } })).toBe(0.3)
  })

  it('carriedOpacityOf는 줍는 수인데 들고 있지 않으면 안 보인다', () => {
    expect(carry({ pickedUp: PICKED })).toBe(0)
  })

  it('carriedOpacityOf는 놓는 수에 내 이동 몫만큼 사라진다', () => {
    expect(carry({ placed: PLACED })).toBeCloseTo(0.6)
  })

  it('carriedOpacityOf는 들고 있으면 1, 아니면 0이다', () => {
    expect(carry({ game: { carrying: 'seed' } })).toBe(1)
    expect(carry({})).toBe(0)
  })

  it('carriedBaseOf는 큐브 윗면에 내려앉음과 떠오름을 더한다', () => {
    expect(carriedBaseOf({ x: 10, y: 100 }, 4, { lift: 6 })).toEqual({
      x: 10,
      y: 100 - TILE.layer + 4 - 6,
    })
  })

  it('rollingTilt는 구른 정도만큼 윗면을 따라 기울고 그만큼 떠오른다', () => {
    const cube = { angle: Math.PI / 4, direction: 'right' as const }
    const roll = carriedRoll(0.5, false)
    const tilted = tiltOnTop('right', roll.angle)(3, -2, 5)

    expect(rollingTilt(cube, { in: false, out: false })(3, -2, 5)).toEqual({
      x: tilted.x,
      y: tilted.y - roll.hop,
    })
  })

  it('rollingTilt는 이어서 구르면 낮게 떠오른다', () => {
    const cube = { angle: Math.PI / 4, direction: 'right' as const }
    const roll = carriedRoll(0.5, true)
    const tilted = tiltOnTop('right', roll.angle)(0, 0, 0)

    expect(rollingTilt(cube, { in: true, out: false })(0, 0, 0).y).toBe(tilted.y - roll.hop)
  })

  const rolling = () => ({ x: 0, y: 0 })
  const tilt = (view: Partial<Parameters<typeof carriedTilt>[0]>) =>
    carriedTilt({
      events: [],
      moving: true,
      t: 0.5,
      swampSeconds: swampTime(null, createState(STAGE)),
      cube: { angle: 0.3, direction: 'left' },
      rolling,
      ...view,
    })

  it('carriedTilt는 막힌 수에 큐브와 같은 각도로 기운다', () => {
    const bump = tilt({ events: [{ type: 'blocked', direction: 'left' }], moving: false })

    expect(bump?.(1, 2, 3)).toEqual(tiltOnTop('left', 0.3)(1, 2, 3))
  })

  it('carriedTilt는 바람에 밀리거나 기대는 동안 큐브와 같은 각도로 기운다', () => {
    const { events } = gust()
    const bump = tilt({ events, t: 0.7 })

    expect(bump).not.toBe(rolling)
    expect(bump?.(1, 2, 3)).toEqual(tiltOnTop('left', 0.3)(1, 2, 3))
  })

  it('carriedTilt는 구르는 동안 rolling을 쓴다', () => {
    expect(tilt({})).toBe(rolling)
  })

  it('carriedTilt는 멈춰 있거나 기울지 않으면 없다', () => {
    expect(tilt({ moving: false })).toBeUndefined()
    expect(tilt({ cube: { angle: 0, direction: 'left' } })).toBeUndefined()
  })

  it('ladderTilt는 2px 위에서 같은 기울기를 쓰고 기울기가 없으면 없다', () => {
    const bump = tiltOnTop('up', 0.2)

    expect(ladderTilt(bump)?.(1, 2, 3)).toEqual(bump(1, 2, 5))
    expect(ladderTilt(undefined)).toBeUndefined()
  })
})
