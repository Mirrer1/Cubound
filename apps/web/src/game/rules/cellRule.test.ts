import { describe, expect, it } from 'vitest'

import { hasBox, hasStone, isFrozen, isWater, same, step } from './cellRule'
import { createState } from './stateRule'
import { BOX_STAGE } from './testStages'

describe('same', () => {
  it('좌표가 같으면 참이다', () => {
    expect(same({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(true)
  })

  it('좌표가 하나라도 다르면 거짓이다', () => {
    expect(same({ x: 1, y: 2 }, { x: 2, y: 2 })).toBe(false)
    expect(same({ x: 1, y: 2 }, { x: 1, y: 1 })).toBe(false)
  })
})

describe('step', () => {
  it('방향마다 한 칸 옆 좌표를 돌려준다', () => {
    const p = { x: 1, y: 1 }

    expect(step(p, 'up')).toEqual({ x: 1, y: 0 })
    expect(step(p, 'right')).toEqual({ x: 2, y: 1 })
    expect(step(p, 'down')).toEqual({ x: 1, y: 2 })
    expect(step(p, 'left')).toEqual({ x: 0, y: 1 })
  })
})

describe('hasBox', () => {
  it('상자가 있는 칸에서만 참이다', () => {
    const state = createState(BOX_STAGE)

    expect(hasBox(state, { x: 1, y: 1 })).toBe(true)
    expect(hasBox(state, { x: 2, y: 1 })).toBe(false)
  })
})

describe('isWater', () => {
  it('물 높이보다 낮은 바닥 칸만 물 칸이고 바닥 없는 칸과 물이 없는 판은 제외한다', () => {
    const stage = { ...BOX_STAGE, heights: [[2, 1, 0, -1]], water: 1 }
    const state = createState(stage)

    expect(isWater(state, { x: 2, y: 0 })).toBe(true)
    expect(isWater(state, { x: 1, y: 0 })).toBe(false)
    expect(isWater(state, { x: 0, y: 0 })).toBe(false)
    expect(isWater(state, { x: 3, y: 0 })).toBe(false)
    expect(isWater(createState({ ...stage, water: undefined }), { x: 2, y: 0 })).toBe(false)
  })
})

// 물 높이 1, x 1~3과 y 1~2가 물 칸
const POND = {
  ...BOX_STAGE,
  heights: [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
  ],
  water: 1,
  entities: [],
}

describe('hasStone', () => {
  it('얼음 돌이 있는 칸에서만 참이다', () => {
    const state = createState({ ...POND, entities: [{ type: 'iceStone', x: 1, y: 0 }] })

    expect(hasStone(state, { x: 1, y: 0 })).toBe(true)
    expect(hasStone(state, { x: 2, y: 0 })).toBe(false)
  })
})

describe('isFrozen', () => {
  it('땅 위 돌은 위아래 왼쪽 오른쪽의 물 칸만 얼리고 대각선과 땅은 제외한다', () => {
    const state = createState({ ...POND, entities: [{ type: 'iceStone', x: 1, y: 0 }] })

    expect(isFrozen(state, { x: 1, y: 1 })).toBe(true)
    expect(isFrozen(state, { x: 2, y: 1 })).toBe(false)
    expect(isFrozen(state, { x: 0, y: 0 })).toBe(false)
    expect(isFrozen(state, { x: 2, y: 0 })).toBe(false)
  })

  it('물에 뜬 돌도 둘레 네 칸을 얼리고 제 칸은 제외한다', () => {
    const state = createState({ ...POND, entities: [{ type: 'iceStone', x: 2, y: 1 }] })

    expect(isFrozen(state, { x: 1, y: 1 })).toBe(true)
    expect(isFrozen(state, { x: 3, y: 1 })).toBe(true)
    expect(isFrozen(state, { x: 2, y: 2 })).toBe(true)
    expect(isFrozen(state, { x: 2, y: 1 })).toBe(false)
    expect(isFrozen(state, { x: 1, y: 2 })).toBe(false)
  })

  it('소용돌이 칸은 얼지 않는다', () => {
    const state = createState({
      ...POND,
      entities: [
        { type: 'iceStone', x: 2, y: 1 },
        { type: 'whirlpool', x: 1, y: 1 },
      ],
    })

    expect(isFrozen(state, { x: 1, y: 1 })).toBe(false)
    expect(isFrozen(state, { x: 3, y: 1 })).toBe(true)
  })
})
