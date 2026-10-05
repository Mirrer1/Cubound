import { describe, expect, it } from 'vitest'

import { VALID, errorsOf } from './testStages'

describe('checkZones', () => {
  it('구역은 맵 안에 있고 모든 바닥 칸을 덮어야 한다', () => {
    expect(errorsOf({ ...VALID, zones: [{ x: 0, y: 0, w: 9, h: 2 }] })).toContain(
      'zones[0]이 맵을 벗어난다',
    )
    expect(errorsOf({ ...VALID, zones: [{ x: 0, y: 0, w: 1, h: 2 }] })).toContain(
      '구역에 속하지 않은 바닥 칸이 있다',
    )
  })
})
