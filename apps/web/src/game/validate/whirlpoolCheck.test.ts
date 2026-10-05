import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

describe('checkWhirlpools', () => {
  // 물 높이 1, (1,1) 소용돌이와 (1,3) 소용돌이, 사이의 (1,2)는 땅
  const WHIRL_VALID = {
    version: 1,
    id: 'whirlpool',
    heights: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 4, y: 4 },
    entities: [
      { type: 'whirlpool', x: 1, y: 1 },
      { type: 'whirlpool', x: 1, y: 3 },
      { type: 'box', x: 3, y: 1 },
    ],
    rules: { plug: true },
  }
  const withEntities = (entities: object[], rest: object = {}) => ({
    ...WHIRL_VALID,
    ...rest,
    entities,
  })

  it('물 칸 위에 줄이 겹치지 않게 둔 소용돌이는 통과한다', () => {
    expect(errorsOf(WHIRL_VALID)).toEqual([])
  })

  it('소용돌이는 물 칸 위에만 둔다', () => {
    expect(errorsOf(withEntities([{ type: 'whirlpool', x: 0, y: 1 }]))).toEqual([
      'entities[0]의 소용돌이가 물 칸에 있지 않다',
    ])
  })

  it('소용돌이 칸에 처음부터 상자를 둘 수 없다', () => {
    const errors = errorsOf(
      withEntities([
        { type: 'box', x: 1, y: 1 },
        { type: 'whirlpool', x: 1, y: 1 },
      ]),
    )

    expect(errors).toContain('entities[1]이 다른 오브젝트와 같은 칸에 있다')
  })

  it('두 소용돌이의 끄는 줄이 같은 칸을 지나거나 한 줄에 다른 소용돌이가 있으면 안 된다', () => {
    const pond = [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 0, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ]
    const crossing = withEntities(
      [
        { type: 'whirlpool', x: 3, y: 1 },
        { type: 'whirlpool', x: 1, y: 3 },
      ],
      { heights: pond },
    )
    const facing = withEntities(
      [
        { type: 'whirlpool', x: 1, y: 1 },
        { type: 'whirlpool', x: 3, y: 1 },
        { type: 'box', x: 2, y: 1 },
      ],
      { heights: pond },
    )

    expect(errorsOf(crossing)).toEqual(['소용돌이 둘의 끄는 줄이 겹친다'])
    expect(errorsOf(facing)).toEqual(['소용돌이 둘의 끄는 줄이 겹친다'])
  })

  it('소용돌이와 말뚝을 한 판에 같이 둘 수 없다', () => {
    const entities = [
      ...WHIRL_VALID.entities,
      { type: 'post', x: 4, y: 1, length: 1, boat: { x: 3, y: 1 } },
    ]

    expect(errorsOf(withEntities(entities))).toEqual(['소용돌이와 말뚝을 한 판에 같이 둘 수 없다'])
  })

  it('rules.plug는 참이나 거짓이어야 한다', () => {
    expect(errorsOf({ ...WHIRL_VALID, rules: { plug: 1 } })).toEqual([
      'rules.plug는 참이나 거짓이어야 한다',
    ])
  })
})
