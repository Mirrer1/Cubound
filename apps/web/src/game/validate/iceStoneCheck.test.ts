import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

describe('checkIceStones', () => {
  // 물 높이 1, x 1~3과 y 1이 물 칸
  const STONE_VALID = {
    version: 1,
    id: 'ice-stone',
    heights: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 2 },
    entities: [{ type: 'iceStone', x: 1, y: 0 }],
  }
  const withEntities = (entities: object[], rest: object = {}) => ({
    ...STONE_VALID,
    ...rest,
    entities,
  })

  it('땅 위와 물에 뜬 얼음 돌은 통과한다', () => {
    expect(errorsOf(STONE_VALID)).toEqual([])
    expect(errorsOf(withEntities([{ type: 'iceStone', x: 2, y: 1 }]))).toEqual([])
  })

  it('바닥 없는 칸과 다른 오브젝트 칸에는 둘 수 없다', () => {
    const heights = [
      [1, -1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]
    const whirlpool = [
      { type: 'whirlpool', x: 2, y: 1 },
      { type: 'iceStone', x: 2, y: 1 },
    ]

    expect(errorsOf(withEntities([{ type: 'iceStone', x: 1, y: 0 }], { heights }))).toEqual([
      'entities[0]이 바닥 칸이 아니다',
    ])
    expect(errorsOf(withEntities(whirlpool))).toEqual([
      'entities[1]이 다른 오브젝트와 같은 칸에 있다',
    ])
  })

  it('상자처럼 무너지는 칸에서 시작해도 된다', () => {
    const cracks = ['.2...', '.....', '.....']

    expect(errorsOf({ ...STONE_VALID, cracks })).toEqual([])
  })

  it('녹는 판에는 얼음 돌이 있어야 한다', () => {
    expect(errorsOf({ ...STONE_VALID, rules: { melt: 3 } })).toEqual([])
    expect(errorsOf(withEntities([], { rules: { melt: 3 } }))).toEqual([
      'rules.melt 판에 얼음 돌이 없다',
    ])
  })

  it('녹는 판에서 처음부터 물에 뜬 얼음 돌은 하나까지다', () => {
    const one = [
      { type: 'iceStone', x: 1, y: 1 },
      { type: 'iceStone', x: 2, y: 0 },
    ]
    const two = [
      { type: 'iceStone', x: 1, y: 1 },
      { type: 'iceStone', x: 3, y: 1 },
    ]

    expect(errorsOf(withEntities(one, { rules: { melt: 3 } }))).toEqual([])
    expect(errorsOf(withEntities(two))).toEqual([])
    expect(errorsOf(withEntities(two, { rules: { melt: 3 } }))).toEqual([
      'rules.melt 판에 처음부터 물에 뜬 얼음 돌이 둘 이상이다',
    ])
  })
})
