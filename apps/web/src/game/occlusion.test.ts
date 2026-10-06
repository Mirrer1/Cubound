import { describe, expect, it } from 'vitest'

import { fadedCells, hiddenFills, hiddenObjects, occludingCells } from './occlusion'
import { createState } from './rules'
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

  it('큐브와 같은 높이에 놓인 상자는 옆면만 가려 흐리지 않는다', () => {
    const heights = [
      [1, 1],
      [1, 1],
    ]

    expect(occludingCells(heights, { x: 0, y: 0 }, 1, [{ x: 1, y: 0 }])).toEqual([])
    expect(occludingCells(heights, { x: 0, y: 0 }, 1, [{ x: 0, y: 1 }])).toEqual([])
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

describe('hiddenFills', () => {
  const PIT: Stage = {
    version: 1,
    id: 't',
    heights: [
      [0, 0, -1],
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ],
    start: { x: 0, y: 0 },
    goal: { x: 0, y: 3 },
    entities: [{ type: 'box', x: 1, y: 0 }],
  }

  it('상자로 메운 칸을 세 칸 떨어진 높은 칸이 가리면 찾는다', () => {
    const heights = PIT.heights.map((row, y) => (y === 3 ? [0, 0, 4] : row))

    expect(hiddenFills({ ...PIT, heights })).toEqual([
      { kind: 'fill', target: { x: 2, y: 0, h: 0 }, cover: { x: 2, y: 3, h: 4 }, px: 42 },
    ])
  })

  it('메운 칸 앞이 낮으면 가리지 않는다', () => {
    expect(hiddenFills(PIT)).toEqual([])
  })

  it('상자로 메울 수 없는 구덩이는 보지 않는다', () => {
    const heights = PIT.heights.map((row, y) => (y === 3 ? [0, 0, 4] : row))

    expect(hiddenFills({ ...PIT, heights, entities: [] })).toEqual([])
  })

  it('탐색 한도를 넘으면 null', () => {
    expect(hiddenFills(PIT, { maxStates: 1 })).toBeNull()
  })
})

describe('fadedCells', () => {
  const STAGE: Stage = {
    version: 1,
    id: 'test',
    name: '테스트',
    heights: [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
    start: { x: 0, y: 0 },
    goal: { x: 3, y: 3 },
    entities: [],
  }
  const raise = (cells: [number, number, number][]) =>
    STAGE.heights.map((row, y) =>
      row.map((h, x) => cells.find(([a, b]) => a === x && b === y)?.[2] ?? h),
    )

  it('큐브를 가리는 앞 칸을 모은다', () => {
    const state = createState(STAGE)

    expect(fadedCells(raise([[1, 0, 1]]), { x: 0, y: 0 }, 0, state, [])).toEqual([{ x: 1, y: 0 }])
  })

  it('물에 뜬 상자는 수면 높이로 재서 같은 높이 둑은 가리지 않는다', () => {
    // 물 높이 2, (0,0) 물 칸의 배 오른쪽 (1,0)이 높이 2 둑이고 그 위에 상자
    const heights = [
      [0, 2, 2],
      [2, 2, 2],
    ]
    const state = {
      ...createState({ ...STAGE, heights, water: 2, start: { x: 2, y: 1 } }),
      boxes: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
    }

    expect(fadedCells(heights, { x: 2, y: 1 }, 2, state, [])).toEqual([])
  })

  it('큐브에서 먼 물에 뜬 배는 윗면보다 한 층 넘게 높은 앞 칸만 흐린다', () => {
    // 물 높이 1, (0,0) 물 칸의 배 오른쪽 (1,0)이 높이 2 둑
    const heights = [[0, 2, 3]]
    const state = {
      ...createState({ ...STAGE, heights, water: 1, start: { x: 2, y: 0 } }),
      boxes: [{ x: 0, y: 0 }],
    }

    expect(fadedCells(heights, { x: 2, y: 0 }, 3, state, [])).toEqual([])
  })

  it('큐브에서 먼 상자와 메운 칸과 씨앗을 가리는 앞 칸도 모은다', () => {
    const state = {
      ...createState(STAGE),
      boxes: [{ x: 2, y: 0 }],
      seeds: [{ x: 1, y: 2 }],
    }
    const shown = raise([
      [3, 0, 2],
      [0, 2, 1],
      [1, 3, 1],
    ])

    expect(fadedCells(shown, { x: 3, y: 3 }, 0, state, [{ x: 0, y: 1 }])).toEqual([
      { x: 3, y: 0 },
      { x: 0, y: 2 },
      { x: 1, y: 3 },
    ])
  })

  it('큐브가 선 칸에서 오른쪽이나 아래로 기댄 사다리를 가리는 칸만 모은다', () => {
    const shown = raise([[1, 0, 1]])
    const right = {
      ...createState(STAGE),
      leaningLadders: [{ x: 0, y: 0, direction: 'right' as const }],
    }
    const up = { ...right, leaningLadders: [{ x: 0, y: 0, direction: 'up' as const }] }

    expect(fadedCells(shown, { x: 3, y: 3 }, 0, right, [])).toEqual([{ x: 1, y: 0 }])
    expect(fadedCells(shown, { x: 3, y: 3 }, 0, up, [])).toEqual([])
  })
})
