import { describe, expect, it } from 'vitest'

import { occludingCells } from './occlusion'

describe('occludingCells', () => {
  it('바로 앞의 한 층 높은 칸은 가린다', () => {
    const heights = [
      [0, 1],
      [1, 0],
    ]

    expect(occludingCells(heights, { x: 0, y: 0 }, 0)).toEqual([
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ])
  })

  it('같은 높이 칸은 가리지 않는다', () => {
    expect(occludingCells([[1, 1]], { x: 0, y: 0 }, 1)).toEqual([])
  })

  it('대각선 앞 칸은 두 층 이상 높아야 가린다', () => {
    const low = [
      [0, 0],
      [0, 1],
    ]
    const high = [
      [0, 0],
      [0, 2],
    ]

    expect(occludingCells(low, { x: 0, y: 0 }, 0)).toEqual([])
    expect(occludingCells(high, { x: 0, y: 0 }, 0)).toEqual([{ x: 1, y: 1 }])
  })

  it('옆으로 두 칸 떨어진 칸은 화면에서 겹치지 않아 제외한다', () => {
    expect(occludingCells([[0, 0, 9]], { x: 0, y: 0 }, 0)).toEqual([])
  })

  it('뒤쪽 칸과 바닥 없는 칸은 제외한다', () => {
    const heights = [
      [5, 5, 5],
      [5, 0, -1],
      [5, -1, 0],
    ]

    expect(occludingCells(heights, { x: 1, y: 1 }, 0)).toEqual([])
  })
})
