import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkCracks', () => {
  it('무너지는 칸은 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'cracks는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...VALID, cracks: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, cracks: ['21.', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, cracks: ['...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, cracks: ['..', '...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, cracks: '...' })).toContain(shape)
  })

  it('무너지는 칸 값은 점이나 1~9여야 한다', () => {
    const value = 'cracks 값은 점이나 1~9여야 한다'

    expect(errorsOf({ ...VALID, cracks: ['0..', '...'] })).toContain(value)
    expect(errorsOf({ ...VALID, cracks: ['#..', '...'] })).toContain(value)
  })

  it('바닥 없는 칸에는 무너지는 칸을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, cracks: ['...', '.2.'] })).toContain(
      '바닥 없는 칸에 무너지는 칸이 있다',
    )
  })

  it('얼음과 무너지는 칸은 겹칠 수 없다', () => {
    expect(errorsOf({ ...VALID, ice: ['.#.', '...'], cracks: ['.2.', '...'] })).toContain(
      '얼음 칸에 무너지는 칸이 있다',
    )
  })

  it('목표 칸에는 무너지는 칸을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, cracks: ['...', '..2'] })).toContain('goal이 무너지는 칸에 있다')
  })
})
