import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkSwamp', () => {
  const NO_ENTITY = { ...VALID, entities: [{ type: 'box', x: 1, y: 0 }] }

  it('늪 마스크는 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'swamp는 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...VALID, swamp: undefined })).toEqual([])
    expect(errorsOf({ ...NO_ENTITY, swamp: ['..#', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, swamp: ['...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, swamp: ['..', '...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, swamp: '...' })).toContain(shape)
  })

  it('바닥 없는 칸에는 늪을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, swamp: ['...', '.#.'] })).toContain('바닥 없는 칸에 늪이 있다')
  })

  it('얼음과 무너지는 칸에는 늪을 둘 수 없다', () => {
    expect(errorsOf({ ...NO_ENTITY, ice: ['..#', '...'], swamp: ['..#', '...'] })).toContain(
      '얼음 칸에 늪이 있다',
    )
    expect(errorsOf({ ...NO_ENTITY, cracks: ['..2', '...'], swamp: ['..#', '...'] })).toContain(
      '무너지는 칸에 늪이 있다',
    )
  })

  it('시작 칸과 목표 칸에는 늪을 둘 수 없다', () => {
    expect(errorsOf({ ...NO_ENTITY, swamp: ['#..', '...'] })).toContain('start가 늪 칸에 있다')
    expect(errorsOf({ ...NO_ENTITY, swamp: ['...', '..#'] })).toContain('goal이 늪 칸에 있다')
  })

  it('다른 오브젝트는 늪 칸에 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, swamp: ['.#.', '...'] })).toContain('entities[0]이 늪 칸에 있다')
    expect(errorsOf({ ...VALID, swamp: ['..#', '...'] })).toContain('entities[2]이 늪 칸에 있다')
  })
})
