import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkIce', () => {
  it('얼음 마스크는 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'ice는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...VALID, ice: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, ice: ['.#.', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, ice: ['...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, ice: ['..', '...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, ice: '...' })).toContain(shape)
  })

  it('바닥 없는 칸에는 얼음을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, ice: ['...', '.#.'] })).toContain('바닥 없는 칸에 얼음이 있다')
  })
})
