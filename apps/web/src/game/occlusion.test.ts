import { describe, expect, it } from 'vitest'

import { hiddenObjects, occludingCells } from './occlusion'
import type { Stage } from './types'

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

  it('같은 높이 칸이어도 위에 상자가 있으면 가린다', () => {
    const heights = [
      [1, 1],
      [1, 1],
    ]

    expect(occludingCells(heights, { x: 0, y: 0 }, 1, [{ x: 1, y: 0 }])).toEqual([{ x: 1, y: 0 }])
  })

  it('앞쪽 칸에 상자가 없으면 상자 목록이 있어도 결과가 같다', () => {
    const heights = [
      [1, 1],
      [1, 1],
    ]

    expect(occludingCells(heights, { x: 0, y: 0 }, 1, [{ x: 1, y: 1 }])).toEqual([])
  })

  it('대각선 앞 칸은 상자를 얹어도 한 층 높아야 가린다', () => {
    const low = [
      [0, 0],
      [0, 0],
    ]
    const high = [
      [0, 0],
      [0, 1],
    ]
    const boxes = [{ x: 1, y: 1 }]

    expect(occludingCells(low, { x: 0, y: 0 }, 0, boxes)).toEqual([])
    expect(occludingCells(high, { x: 0, y: 0 }, 0, boxes)).toEqual([{ x: 1, y: 1 }])
  })

  it('상자 목록이 비어 있으면 결과가 전과 같다', () => {
    const heights = [
      [0, 1],
      [1, 0],
    ]

    expect(occludingCells(heights, { x: 0, y: 0 }, 0, [])).toEqual(
      occludingCells(heights, { x: 0, y: 0 }, 0),
    )
  })
})

describe('hiddenObjects', () => {
  const stage = (heights: number[][], extra: Partial<Stage> = {}): Stage => ({
    version: 1,
    id: 't',
    heights,
    start: { x: 0, y: 0 },
    goal: { x: 0, y: 0 },
    entities: [],
    ...extra,
  })

  it('두 칸 떨어진 높은 칸이 상자를 가리면 겹침 px과 함께 찾는다', () => {
    const heights = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 4],
    ]
    const found = hiddenObjects(
      stage(heights, { goal: { x: 2, y: 2 }, entities: [{ type: 'box', x: 0, y: 0 }] }),
    )

    expect(found).toEqual([
      { kind: 'box', target: { x: 0, y: 0, h: 0 }, cover: { x: 2, y: 2, h: 4 }, px: 16 },
    ])
  })

  it('겹침이 없거나 같은 높이면 가리지 않는다', () => {
    expect(hiddenObjects(stage([[0, 1, 1]], { goal: { x: 2, y: 0 }, mushroom: ['#..'] }))).toEqual([
      { kind: 'mushroom', target: { x: 0, y: 0, h: 0 }, cover: { x: 1, y: 0, h: 1 }, px: 4 },
    ])
    expect(hiddenObjects(stage([[1, 1]], { goal: { x: 1, y: 0 }, mushroom: ['#.'] }))).toEqual([])
  })

  it('바닥 없는 칸은 가리지 않는다', () => {
    expect(hiddenObjects(stage([[0, -1]], { swamp: ['#.'] }))).toEqual([])
  })

  it('뒤쪽 칸은 높아도 가리지 않는다', () => {
    const heights = [
      [5, 5],
      [5, 0],
    ]

    expect(hiddenObjects(stage(heights, { goal: { x: 1, y: 1 } }))).toEqual([])
  })

  it('겹침이 큰 것부터 늘어놓고 사다리도 대상으로 본다', () => {
    const heights = [[0, 1, 2]]
    const found = hiddenObjects(
      stage(heights, { goal: { x: 2, y: 0 }, entities: [{ type: 'ladder', x: 0, y: 0 }] }),
    )

    expect(found.map((h) => [h.kind, h.cover.x, h.px])).toEqual([
      ['ladder', 2, 8],
      ['ladder', 1, 4],
    ])
  })
})
