import { describe, expect, it } from 'vitest'

import { TILE, blockFaces, toScreen } from './iso'

describe('toScreen', () => {
  it('원점 칸은 화면 원점에 놓인다', () => {
    expect(toScreen({ x: 0, y: 0 }, 0)).toEqual({ x: 0, y: 0 })
  })

  it('up은 화면 오른쪽 위, right는 화면 오른쪽 아래로 간다', () => {
    const up = toScreen({ x: 0, y: -1 }, 0)
    const right = toScreen({ x: 1, y: 0 }, 0)

    expect(up.x).toBeGreaterThan(0)
    expect(up.y).toBeLessThan(0)
    expect(right.x).toBeGreaterThan(0)
    expect(right.y).toBeGreaterThan(0)
  })

  it('높이 1당 한 층만큼 위로 올라간다', () => {
    expect(toScreen({ x: 2, y: 1 }, 2).y).toBe(toScreen({ x: 2, y: 1 }, 0).y - TILE.layer * 2)
  })
})

describe('blockFaces', () => {
  it('윗면은 폭의 절반 높이인 2:1 마름모다', () => {
    expect(blockFaces(0, 0, 104, 30).top).toBe('0,-26 52,0 0,26 -52,0')
  })
})
