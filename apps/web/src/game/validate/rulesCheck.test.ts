import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkRules', () => {
  it('rules는 없어도 되고 객체가 아니면 실패한다', () => {
    expect(errorsOf({ ...VALID, rules: undefined })).toEqual([])
    expect(errorsOf({ ...VALID, rules: {} })).toEqual([])
    expect(errorsOf({ ...VALID, rules: 24 })).toContain('rules가 객체가 아니다')
  })

  it('이동 제한은 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { moveLimit: value } })

    expect(limit(6)).toEqual([])
    expect(limit(0)).toContain('rules.moveLimit은 양의 정수여야 한다')
    expect(limit(-1)).toContain('rules.moveLimit은 양의 정수여야 한다')
    expect(limit(5.5)).toContain('rules.moveLimit은 양의 정수여야 한다')
  })

  it('이동 제한이 best보다 작으면 실패한다', () => {
    expect(errorsOf({ ...VALID, rules: { moveLimit: 5 } })).toEqual([])
    expect(errorsOf({ ...VALID, rules: { moveLimit: 4 } })).toContain(
      'rules.moveLimit이 best보다 작다',
    )
  })

  it('밀기 제한은 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { pushLimit: value } })

    expect(limit(3)).toEqual([])
    expect(limit(0)).toContain('rules.pushLimit은 양의 정수여야 한다')
    expect(limit(-1)).toContain('rules.pushLimit은 양의 정수여야 한다')
    expect(limit(2.5)).toContain('rules.pushLimit은 양의 정수여야 한다')
  })

  it('올라가기 제한은 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { climbLimit: value } })

    expect(limit(3)).toEqual([])
    expect(limit(0)).toContain('rules.climbLimit은 양의 정수여야 한다')
    expect(limit(-1)).toContain('rules.climbLimit은 양의 정수여야 한다')
    expect(limit(2.5)).toContain('rules.climbLimit은 양의 정수여야 한다')
  })

  it('타는 횟수 제한은 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { rideLimit: value } })

    expect(limit(3)).toEqual([])
    expect(limit(0)).toContain('rules.rideLimit은 양의 정수여야 한다')
    expect(limit(-1)).toContain('rules.rideLimit은 양의 정수여야 한다')
    expect(limit(2.5)).toContain('rules.rideLimit은 양의 정수여야 한다')
  })

  it('방향 제한은 네 방향 중 하나와 양의 정수여야 한다', () => {
    const limit = (value: unknown) => errorsOf({ ...VALID, rules: { dirLimit: value } })

    expect(limit({ dir: 'left', count: 4 })).toEqual([])
    expect(limit(4)).toContain('rules.dirLimit.dir은 네 방향 중 하나여야 한다')
    expect(limit({ dir: 'west', count: 4 })).toContain(
      'rules.dirLimit.dir은 네 방향 중 하나여야 한다',
    )
    expect(limit({ dir: 'left', count: 0 })).toContain('rules.dirLimit.count는 양의 정수여야 한다')
    expect(limit({ dir: 'left', count: -1 })).toContain('rules.dirLimit.count는 양의 정수여야 한다')
    expect(limit({ dir: 'left', count: 2.5 })).toContain(
      'rules.dirLimit.count는 양의 정수여야 한다',
    )
  })

  it('깊어지는 늪은 참이나 거짓이어야 한다', () => {
    const deepen = (value: unknown) => errorsOf({ ...VALID, rules: { swampDeepen: value } })

    expect(deepen(true)).toEqual([])
    expect(deepen(false)).toEqual([])
    expect(deepen(1)).toContain('rules.swampDeepen은 참이나 거짓이어야 한다')
  })
})

describe('checkRules 바람', () => {
  it('바람은 네 방향 중 하나여야 한다', () => {
    const wind = (value: unknown) => errorsOf({ ...VALID, rules: { wind: value } })

    expect(wind('left')).toEqual([])
    expect(wind('north')).toContain('rules.wind는 네 방향 중 하나여야 한다')
    expect(wind(1)).toContain('rules.wind는 네 방향 중 하나여야 한다')
  })

  it('바람 가이드를 바람 칸에 둔다', () => {
    const guides = [{ id: 'wind', target: 'wind' }]

    expect(errorsOf({ ...VALID, rules: { wind: 'left' }, guides })).toEqual([])
  })
})
