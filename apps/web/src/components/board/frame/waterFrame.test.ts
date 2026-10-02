import { describe, expect, it } from 'vitest'

import { movingBox } from './boxFrame'
import { playerFrame } from './cubeFrame'
import { lastMove } from './testStages'
import { durationOf } from './timeFrame'
import { FLOAT, floatGone, floatLevel, rippleOf, shoveDirection } from './waterFrame'
import type { Stage } from '@/game/types'

// 물 높이 1, x 2~4가 물인 한 줄, 상자 하나는 땅에 하나는 물에
const WATER_STAGE: Stage = {
  version: 1,
  id: 'test-water',
  heights: [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1, 1],
  ],
  water: 1,
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 0 },
  entities: [{ type: 'box', x: 1, y: 1 }],
}

const RIDING: Stage = {
  ...WATER_STAGE,
  start: { x: 3, y: 0 },
  entities: [{ type: 'box', x: 3, y: 1 }],
}

describe('floatLevel', () => {
  it('가로로 넘어가는 동안은 출발 높이다', () => {
    expect(floatLevel(1, 0, 0)).toBe(1)
    expect(floatLevel(1, 0, FLOAT.drop)).toBe(1)
  })

  it('제 높이보다 더 잠겼다가 끝에서 제 높이로 떠오른다', () => {
    expect(floatLevel(1, 0, FLOAT.rise)).toBeCloseTo(-FLOAT.sink)
    expect(floatLevel(1, 0, 1)).toBe(0)
    expect(floatLevel(1, 0, 0.9)).toBeLessThan(0)
  })
})

describe('floatGone', () => {
  it('구간 앞쪽에서 가로 이동을 다 마친다', () => {
    expect(floatGone(0)).toBe(0)
    expect(floatGone(FLOAT.reach)).toBe(1)
    expect(floatGone(1)).toBe(1)
  })
})

describe('movingBox 물', () => {
  it('물에 떨어뜨린 상자는 끝에서 물 높이 아래 한 층에 앉는다', () => {
    const { prev, game, events } = lastMove(WATER_STAGE, ['right'])

    expect(movingBox(prev, game, events, 0.3)?.level).toBe(1)
    expect(movingBox(prev, game, events, 0.75)!.level).toBeLessThan(0)
    expect(movingBox(prev, game, events, 0.999)!.level).toBeCloseTo(0, 2)
  })

  it('물에 떨어뜨리는 밀기는 잠겼다 떠오르는 몫까지 0.5초다', () => {
    const { events } = lastMove(WATER_STAGE, ['right'])

    expect(durationOf(events)).toBeCloseTo(0.5)
  })
})

describe('rippleOf', () => {
  it('상자가 잠긴 뒤부터 고리가 커지며 옅어지고 끝에서 사라진다', () => {
    const { events } = lastMove(WATER_STAGE, ['right'])
    const early = rippleOf(events, 0.4)
    const mid = rippleOf(events, 0.8)
    const end = rippleOf(events, 1)

    expect(early).toBeNull()
    expect(mid?.at).toEqual({ x: 2, y: 1 })
    expect(mid!.size).toBeGreaterThan(0.75)
    expect(end!.opacity).toBe(0)
    expect(end!.size).toBeCloseTo(1.05)
  })

  it('물에 떨어지지 않은 밀기에는 고리가 없다', () => {
    const { events } = lastMove({ ...WATER_STAGE, start: { x: 1, y: 0 } }, ['down'])

    expect(rippleOf(events, 0.9)).toBeNull()
  })
})

describe('shoveDirection', () => {
  it('물가에서 뜬 상자를 밀고 남은 큐브는 민 쪽으로 기운다', () => {
    const stage: Stage = {
      ...WATER_STAGE,
      start: { x: 1, y: 1 },
      entities: [{ type: 'box', x: 2, y: 1 }],
    }
    const { prev, game, events } = lastMove(stage, ['right'])

    expect(shoveDirection(events)).toBe('right')
    expect(playerFrame(prev, game, events, 0.5).angle).toBeGreaterThan(0)
    expect(playerFrame(prev, game, events, 0.5).x).toBe(1)
  })

  it('큐브가 따라 들어가는 밀기는 기울지 않는다', () => {
    const { events } = lastMove(WATER_STAGE, ['right'])

    expect(shoveDirection(events)).toBeNull()
  })
})

describe('저어 가기', () => {
  it('큐브와 뜬 상자가 같은 자리로 같이 가고 큐브는 구르지 않는다', () => {
    const { prev, game, events } = lastMove(RIDING, ['down', 'right'])

    for (const t of [0.2, 0.5, 0.8]) {
      const cube = playerFrame(prev, game, events, t)
      const box = movingBox(prev, game, events, t)!
      expect(cube.x).toBeCloseTo(box.x)
      expect(cube.y).toBeCloseTo(box.y)
      expect(cube.level).toBe(box.level + 1)
      expect(cube.angle).toBe(0)
    }
  })

  it('저어 가는 수는 0.3초다', () => {
    const { events } = lastMove(RIDING, ['down', 'right'])

    expect(durationOf(events)).toBeCloseTo(0.3)
  })
})
