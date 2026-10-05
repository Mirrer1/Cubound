import { describe, expect, it } from 'vitest'

import { errorsOf } from './testStages'

describe('checkTethers', () => {
  // (0,1) 말뚝에 줄 길이 2로 묶인 배가 (1,1)
  const TETHER_VALID = {
    version: 1,
    id: 'tether',
    heights: [
      [1, 1, 1, 1, 1],
      [1, 0, 0, 0, 1],
      [1, 1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 1, y: 0 },
    goal: { x: 4, y: 2 },
    entities: [
      { type: 'box', x: 1, y: 1 },
      { type: 'post', x: 0, y: 1, length: 2, boat: { x: 1, y: 1 } },
    ],
  }
  const withPost = (post: object, entities: object[] = [{ type: 'box', x: 1, y: 1 }]) => ({
    ...TETHER_VALID,
    entities: [...entities, { type: 'post', x: 0, y: 1, length: 2, boat: { x: 1, y: 1 }, ...post }],
  })

  it('물가 땅에 박혀 범위 안의 뜬 상자를 묶은 말뚝은 통과한다', () => {
    expect(errorsOf(TETHER_VALID)).toEqual([])
  })

  it('줄 길이는 양의 정수여야 한다', () => {
    const message = 'entities[1]의 줄 길이는 양의 정수여야 한다'

    expect(errorsOf(withPost({ length: 0 }))).toContain(message)
    expect(errorsOf(withPost({ length: 1.5 }))).toContain(message)
    expect(errorsOf(withPost({ length: undefined }))).toContain(message)
  })

  it('말뚝은 물 칸에 박을 수 없다', () => {
    const errors = errorsOf(withPost({ x: 2, y: 1, boat: { x: 1, y: 1 } }))

    expect(errors).toContain('entities[1]이 물 칸에 있다')
  })

  it('말뚝은 물 칸과 맞닿은 땅에만 박는다', () => {
    expect(errorsOf(withPost({ x: 4, y: 0, length: 4 }))).toEqual([
      'entities[1]의 말뚝이 물가에 있지 않다',
    ])
  })

  it('배 자리에는 물에 뜬 상자가 있어야 한다', () => {
    const message = 'entities[1]의 배 자리에 물에 뜬 상자가 없다'

    expect(errorsOf(withPost({ boat: { x: 2, y: 1 } }))).toContain(message)
    expect(errorsOf(withPost({ boat: undefined }))).toContain(message)
    expect(
      errorsOf(withPost({ x: 1, y: 2, boat: { x: 2, y: 2 } }, [{ type: 'box', x: 2, y: 2 }])),
    ).toContain(message)
  })

  it('배는 처음부터 줄 길이 안에 있어야 한다', () => {
    const entities = [{ type: 'box', x: 3, y: 1 }]

    expect(errorsOf(withPost({ boat: { x: 3, y: 1 } }, entities))).toEqual([
      'entities[1]의 배가 줄 길이 밖에 있다',
    ])
  })

  it('배 하나에 말뚝 둘을 묶을 수 없다', () => {
    const entities = [
      ...TETHER_VALID.entities,
      { type: 'post', x: 1, y: 2, length: 2, boat: { x: 1, y: 1 } },
    ]

    expect(errorsOf({ ...TETHER_VALID, entities })).toEqual([
      'entities[2]의 배가 다른 말뚝에도 묶여 있다',
    ])
  })
})
