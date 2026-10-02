import { describe, expect, it } from 'vitest'

import { hasBox, isWater, same, step } from './cellRule'
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
