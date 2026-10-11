import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

// 화약통 (0,0)과 심지 화약통 (2,1)
const KEG_VALID = {
  ...VALID,
  heights: [
    [0, 0, 0],
    [0, 0, 0],
  ],
  start: { x: 1, y: 0 },
  goal: { x: 2, y: 0 },
  entities: [
    { type: 'keg', x: 0, y: 0 },
    { type: 'keg', x: 2, y: 1, fuse: true },
  ],
  guides: undefined,
  zones: [{ x: 0, y: 0, w: 3, h: 2 }],
}

describe('checkKegs', () => {
  it('보통 화약통과 심지 화약통을 둘 수 있다', () => {
    expect(errorsOf(KEG_VALID)).toEqual([])
  })

  it('심지는 true만 쓴다', () => {
    const entities = [{ type: 'keg', x: 0, y: 0, fuse: 4 }]

    expect(errorsOf({ ...KEG_VALID, entities })).toContain('entities[0]의 fuse는 true여야 한다')
  })

  it('늪, 버섯, 물과 한 판에 둘 수 없다', () => {
    const on = (extra: object) => errorsOf({ ...KEG_VALID, ...extra })

    expect(on({ swamp: ['...', '.#.'] })).toContain('화약통 판에 늪이 있다')
    expect(on({ mushroom: ['...', '.#.'] })).toContain('화약통 판에 버섯이 있다')
    expect(
      on({
        water: 1,
        heights: [
          [1, 1, 1],
          [1, 0, 1],
        ],
      }),
    ).toContain('화약통 판에 물이 있다')
  })

  it('바람과 한 판에 둘 수 없다', () => {
    expect(errorsOf({ ...KEG_VALID, rules: { wind: 'up' } })).toContain('화약통 판에 바람이 있다')
  })

  it('덩굴, 씨앗과 한 판에 둘 수 없다', () => {
    const add = (entity: object) =>
      errorsOf({ ...KEG_VALID, entities: [...KEG_VALID.entities, entity] })

    expect(add({ type: 'seed', x: 0, y: 1 })).toContain('화약통 판에 씨앗이 있다')
    expect(add({ type: 'vine', id: 'v', x: 0, y: 1, cells: [{ x: 1, y: 1 }] })).toContain(
      '화약통 판에 덩굴이 있다',
    )
  })

  it('얼음과는 한 판에 둘 수 있다', () => {
    expect(errorsOf({ ...KEG_VALID, ice: ['...', '.#.'] })).toEqual([])
  })
})
