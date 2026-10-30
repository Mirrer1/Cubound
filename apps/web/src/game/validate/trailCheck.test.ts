import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

// 한 줄 판, 불씨 없는 숯 벽 (2,0)
const TRAIL_VALID = {
  ...VALID,
  heights: [[0, 0, 0, 0]],
  fire: ['..#.'],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [],
  guides: undefined,
  zones: [{ x: 0, y: 0, w: 4, h: 1 }],
  rules: { trail: true },
}

describe('checkTrail', () => {
  it('꼬리 불 판은 불씨와 화로 없이 숯을 둘 수 있다', () => {
    expect(errorsOf(TRAIL_VALID)).toEqual([])
    expect(errorsOf({ ...TRAIL_VALID, rules: undefined })).toContain(
      '불씨나 화로와 안 이어진 숯이 (2,0)에 있다',
    )
  })

  it('rules.trail은 참이나 거짓이다', () => {
    expect(errorsOf({ ...TRAIL_VALID, rules: { trail: 1 } })).toContain(
      'rules.trail은 참이나 거짓이어야 한다',
    )
  })

  it('꼬리 불 판에 화로를 두지 않는다', () => {
    expect(errorsOf({ ...TRAIL_VALID, fire: ['.@#.'] })).toContain('rules.trail 판에 화로가 있다')
  })

  it('꼬리 불 판에 다른 불 보스 규칙을 같이 쓰지 않는다', () => {
    const rules = { trail: true, chase: true, burnBox: true }

    expect(errorsOf({ ...TRAIL_VALID, fire: ['*.#.'], rules })).toEqual(
      expect.arrayContaining([
        'rules.chase는 rules.trail과 함께 쓸 수 없다',
        'rules.burnBox는 rules.trail과 함께 쓸 수 없다',
      ]),
    )
    expect(errorsOf({ ...TRAIL_VALID, rules: { trail: true, forge: true } })).toContain(
      'rules.forge는 rules.trail과 함께 쓸 수 없다',
    )
  })
})
