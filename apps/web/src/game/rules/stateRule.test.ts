import { describe, expect, it } from 'vitest'

import { createState, readCracks, readMushrooms, readSwamps } from './stateRule'
import { FLAT_STAGE } from './testStages'

describe('createState', () => {
  it('시작 위치에서 이동 수 0으로 시작한다', () => {
    const state = createState(FLAT_STAGE)

    expect(state.player).toEqual({ x: 1, y: 1 })
    expect(state.moves).toBe(0)
    expect(state.cleared).toBe(false)
  })
})

describe('readCracks', () => {
  it('숫자 칸을 견디는 횟수와 함께 읽는다', () => {
    expect(readCracks({ ...FLAT_STAGE, cracks: ['.2.', '...', '1.9'] })).toEqual([
      { x: 1, y: 0, left: 2 },
      { x: 0, y: 2, left: 1 },
      { x: 2, y: 2, left: 9 },
    ])
  })

  it('cracks가 없으면 비어 있다', () => {
    expect(readCracks(FLAT_STAGE)).toEqual([])
  })
})

describe('readSwamps', () => {
  it("'#' 칸을 행 순서대로 읽는다", () => {
    expect(readSwamps({ ...FLAT_STAGE, swamp: ['..#', '#..', '...'] })).toEqual([
      { x: 2, y: 0 },
      { x: 0, y: 1 },
    ])
  })

  it('swamp가 없으면 비어 있다', () => {
    expect(readSwamps(FLAT_STAGE)).toEqual([])
  })
})

describe('readMushrooms', () => {
  it("'#' 칸을 행 순서대로 읽는다", () => {
    expect(readMushrooms({ ...FLAT_STAGE, mushroom: ['#..', '...', '.#.'] })).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 2 },
    ])
  })

  it('mushroom이 없으면 비어 있다', () => {
    expect(readMushrooms(FLAT_STAGE)).toEqual([])
  })
})
