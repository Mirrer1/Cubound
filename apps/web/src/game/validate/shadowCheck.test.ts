import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

// (1,1) 구덩이 둘레 땅이 모두 높이 0
const FLAT = {
  ...VALID,
  heights: [
    [0, 0, 0],
    [0, -1, 0],
  ],
}

describe('checkShadow', () => {
  it('그림자 다리는 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'shadow는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...FLAT, shadow: undefined })).toEqual([])
    expect(errorsOf({ ...FLAT, shadow: ['...', '.0.'] })).toEqual([])
    expect(errorsOf({ ...FLAT, shadow: ['...'] })).toContain(shape)
    expect(errorsOf({ ...FLAT, shadow: '...' })).toContain(shape)
  })

  it('그림자 다리 값은 점이나 0~9여야 한다', () => {
    expect(errorsOf({ ...FLAT, shadow: ['...', '.#.'] })).toContain(
      'shadow 값은 점이나 0~9여야 한다',
    )
  })

  it('그림자 다리는 바닥 없는 칸에만 둔다', () => {
    expect(errorsOf({ ...FLAT, shadow: ['0..', '.0.'] })).toContain(
      '바닥 있는 칸에 그림자 다리가 있다',
    )
  })

  it('그림자 다리 높이는 이어진 땅 높이와 같아야 한다', () => {
    const level = '그림자 다리 높이가 이어진 땅 높이와 다르다'

    expect(errorsOf({ ...FLAT, shadow: ['...', '.1.'] })).toContain(level)
    expect(errorsOf({ ...VALID, shadow: ['...', '.0.'] })).toContain(level)
  })
})
