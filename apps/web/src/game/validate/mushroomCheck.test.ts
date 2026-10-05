import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkMushroom', () => {
  const NO_ENTITY = { ...VALID, entities: [{ type: 'box', x: 1, y: 0 }] }

  it('버섯 마스크는 없어도 되고 있으면 heights와 같은 모양이어야 한다', () => {
    const shape = 'mushroom은 heights와 같은 모양의 문자열 배열이어야 한다'

    expect(errorsOf({ ...VALID, mushroom: undefined })).toEqual([])
    expect(errorsOf({ ...NO_ENTITY, mushroom: ['..#', '...'] })).toEqual([])
    expect(errorsOf({ ...VALID, mushroom: ['...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, mushroom: ['..', '...'] })).toContain(shape)
    expect(errorsOf({ ...VALID, mushroom: '...' })).toContain(shape)
  })

  it('바닥 없는 칸에는 버섯을 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, mushroom: ['...', '.#.'] })).toContain('바닥 없는 칸에 버섯이 있다')
  })

  it('얼음과 무너지는 칸과 늪에는 버섯을 둘 수 없다', () => {
    expect(errorsOf({ ...NO_ENTITY, ice: ['..#', '...'], mushroom: ['..#', '...'] })).toContain(
      '얼음 칸에 버섯이 있다',
    )
    expect(errorsOf({ ...NO_ENTITY, cracks: ['..2', '...'], mushroom: ['..#', '...'] })).toContain(
      '무너지는 칸에 버섯이 있다',
    )
    expect(errorsOf({ ...NO_ENTITY, swamp: ['..#', '...'], mushroom: ['..#', '...'] })).toContain(
      '늪 칸에 버섯이 있다',
    )
  })

  it('시작 칸과 목표 칸에는 버섯을 둘 수 없다', () => {
    expect(errorsOf({ ...NO_ENTITY, mushroom: ['#..', '...'] })).toContain('start가 버섯 칸에 있다')
    expect(errorsOf({ ...NO_ENTITY, mushroom: ['...', '..#'] })).toContain('goal이 버섯 칸에 있다')
  })

  it('다른 오브젝트는 버섯 칸에 둘 수 없다', () => {
    expect(errorsOf({ ...VALID, mushroom: ['.#.', '...'] })).toContain(
      'entities[0]이 버섯 칸에 있다',
    )
    expect(errorsOf({ ...VALID, mushroom: ['..#', '...'] })).toContain(
      'entities[2]이 버섯 칸에 있다',
    )
  })

  it('시드는 버섯은 참이나 거짓이어야 한다', () => {
    const wither = (value: unknown) => errorsOf({ ...VALID, rules: { mushroomWither: value } })

    expect(wither(true)).toEqual([])
    expect(wither(false)).toEqual([])
    expect(wither(1)).toContain('rules.mushroomWither는 참이나 거짓이어야 한다')
  })
})
