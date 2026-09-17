import { describe, expect, it } from 'vitest'

import { zoneIndexAt } from './camera'

const ZONES = [
  { x: 0, y: 0, w: 5, h: 5 },
  { x: 4, y: 0, w: 5, h: 5 },
]

describe('zoneIndexAt', () => {
  it('큐브가 들어선 구역을 고른다', () => {
    expect(zoneIndexAt(ZONES, { x: 7, y: 2 }, 0)).toBe(1)
  })

  it('겹치는 칸에서는 지금 구역을 유지한다', () => {
    expect(zoneIndexAt(ZONES, { x: 4, y: 2 }, 0)).toBe(0)
    expect(zoneIndexAt(ZONES, { x: 4, y: 2 }, 1)).toBe(1)
  })

  it('어느 구역에도 없으면 첫 구역을 쓴다', () => {
    expect(zoneIndexAt(ZONES, { x: 20, y: 20 }, 1)).toBe(0)
  })
})
