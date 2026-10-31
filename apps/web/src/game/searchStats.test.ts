import { describe, expect, it } from 'vitest'

import {
  barFloats,
  deadEnds,
  filledFloods,
  floodBlocks,
  kegBlocks,
  solutionCount,
  statesWithin,
  tideTraps,
} from './searchStats'
import { moveLimit, solve } from './solver'
import type { Stage } from './types'

const STAGE: Stage = {
  version: 1,
  id: 'test-solver',
  name: '풀이 테스트',
  heights: [
    [0, 0, 0],
    [0, -1, 0],
    [0, 0, 0],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 2, y: 2 },
  entities: [],
}

// 상자를 (1,2)로 밀면 (2,1)을 메울 수단이 없어 막히는 판
const BOX_TRAP: Stage = {
  version: 1,
  id: 'test-dead-end',
  heights: [
    [0, 0, 0, -1],
    [0, 0, -1, 0],
    [0, -1, -1, -1],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 3, y: 1 },
  entities: [{ type: 'box', x: 1, y: 1 }],
}

// 화로 (0,0)에서 불을 붙여 화약통 (2,0)을 터뜨려야 한 층 벽 (3,0)을 넘는 판
const KEG: Stage = {
  version: 1,
  id: 'test-solver-keg',
  heights: [[0, 0, 0, 1, 0]],
  fire: ['@....'],
  start: { x: 1, y: 0 },
  goal: { x: 4, y: 0 },
  entities: [{ type: 'keg', x: 2, y: 0 }],
}

// 막대 (1,0)-(2,0)을 밀어 두 칸 구덩이 (3,0)-(4,0)에 다리를 놓는 판
const BAR: Stage = {
  version: 1,
  id: 'test-solver-bar',
  heights: [[0, 0, 0, -1, -1, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 6, y: 0 },
  entities: [{ type: 'bar', x: 1, y: 0, axis: 'x' }],
}

// 늪을 지나는 짧은 길과 늪이 없는 먼 길이 같은 갈림목에서 만나는 판
const DEEP_SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp-deepen-solver',
  heights: [
    [0, 0, 0, -1, -1, -1, -1],
    [0, -1, 0, -1, -1, -1, -1],
    [0, 0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 2 },
  goal: { x: 6, y: 2 },
  entities: [],
  swamp: ['.......', '.......', '.#.###.'],
  rules: { swampDeepen: true },
}

describe('deadEnds', () => {
  it('상자가 없는 맵은 막히는 상태가 없다', () => {
    expect(deadEnds(STAGE)).toEqual({
      status: 'ok',
      states: 8,
      dead: 0,
      earliest: null,
      beyond: 0,
      beyondEarliest: null,
      depth: Infinity,
    })
  })

  it('상자를 엉뚱한 빈 칸에 밀어 넣으면 막힌 상태가 된다', () => {
    const result = deadEnds(BOX_TRAP)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.dead).toBeGreaterThan(0)
    expect(result.earliest).toBe(3)
  })

  it('탐색 상태 수 한도를 넘으면 limit을 돌려준다', () => {
    expect(deadEnds(STAGE, { maxStates: 2 })).toEqual({ status: 'limit' })
  })

  it('무너지는 칸의 남은 횟수가 다르면 다른 상태로 센다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0]],
      start: { x: 0, y: 0 },
      goal: { x: 2, y: 0 },
      cracks: ['.2.'],
    }

    expect(solve(stage)).toEqual({ status: 'solved', moves: 2, path: ['right', 'right'] })
    expect(deadEnds(stage)).toEqual({
      status: 'ok',
      states: 7,
      dead: 1,
      earliest: 4,
      beyond: 1,
      beyondEarliest: 4,
      depth: Infinity,
    })
  })
})

describe('solutionCount', () => {
  it('최소 이동 수로 가는 길이 둘이면 2가지로 센다', () => {
    expect(solutionCount(STAGE)).toEqual({ status: 'ok', count: 2 })
  })

  it('목표에 갈 수 없으면 0가지다', () => {
    const blocked: Stage = {
      ...STAGE,
      heights: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
      ],
    }

    expect(solutionCount(blocked)).toEqual({ status: 'ok', count: 0 })
  })
})

describe('statesWithin', () => {
  it('최소 이동 수 안에 목표까지 갈 수 있는 상태만 센다', () => {
    expect(statesWithin(STAGE, 4)).toEqual({ status: 'ok', count: 8 })
    expect(statesWithin(STAGE, 3)).toEqual({ status: 'ok', count: 0 })
  })

  it('막힌 상태는 여유를 많이 줘도 세지 않는다', () => {
    const all = deadEnds(BOX_TRAP)
    const inside = statesWithin(BOX_TRAP, 100)

    expect(all.status).toBe('ok')
    expect(inside.status).toBe('ok')
    if (all.status !== 'ok' || inside.status !== 'ok') return
    expect(inside.count).toBe(all.states - all.dead)
  })
})

describe('kegBlocks', () => {
  const PIT: Stage = { ...KEG, heights: [[0, 0, 0, -1, 0]], fire: undefined }

  it('화약통을 구덩이 쪽으로 밀어 막힌 이동을 센다', () => {
    expect(kegBlocks(PIT)).toEqual({ status: 'ok', count: 1 })
  })

  it('구덩이가 없으면 0', () => {
    expect(kegBlocks({ ...PIT, heights: [[0, 0, 0, 0, 0]] })).toEqual({ status: 'ok', count: 0 })
  })
})

describe('barFloats', () => {
  it('긴 구덩이 위로는 막대가 밀리지 않아 0', () => {
    const long: Stage = { ...BAR, heights: [[0, 0, 0, -1, -1, -1, 0]] }

    expect(barFloats(long)).toEqual({ status: 'ok', count: 0 })
  })

  it('두 칸 구덩이 다리는 0', () => {
    expect(barFloats(BAR)).toEqual({ status: 'ok', count: 0 })
  })
})

describe('floodBlocks', () => {
  // 물 높이 1, 가 웅덩이 (1,1)과 (2,1), 나 웅덩이 (4,1)과 (5,1), 사이 (3,1)이 수위 장치
  const LOCK: Stage = {
    version: 1,
    id: 'test-solver-flood',
    heights: [
      [2, 2, 2, 2, 2, 2, 2],
      [2, 0, 1, 2, 1, 0, 2],
      [2, 2, 2, 2, 2, 2, 2],
    ],
    water: 1,
    start: { x: 3, y: 0 },
    goal: { x: 6, y: 0 },
    entities: [{ type: 'sluice', x: 3, y: 1 }],
    rules: { lock: { x: 1, y: 1 } },
  }

  it('장치를 떠나 가 웅덩이의 드러난 칸으로 내려서는 이동을 센다', () => {
    expect(floodBlocks(LOCK)).toEqual({ status: 'ok', count: 1 })
  })

  it('잠기는 칸으로 들어설 길이 없으면 0', () => {
    const heights = LOCK.heights.map((row) => row.map((h) => (h === 1 ? 2 : h)))
    expect(floodBlocks({ ...LOCK, heights })).toEqual({ status: 'ok', count: 0 })
  })

  it('탐색 상태 수 한도를 넘으면 limit', () => {
    expect(floodBlocks(LOCK, { maxStates: 2 })).toEqual({ status: 'limit' })
  })
})

describe('filledFloods', () => {
  // 물 높이 1, 낮은 줄의 상자로 (2,1) 구덩이를 메우고 (4,1) 상자를 딛고 (4,0) 수위 장치로
  const FILL: Stage = {
    version: 1,
    id: 'test-solver-fill',
    heights: [
      [2, 2, 2, 2, 2],
      [1, 1, -1, 1, 1],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 2, y: 0 },
    entities: [
      { type: 'sluice', x: 4, y: 0 },
      { type: 'box', x: 1, y: 1 },
      { type: 'box', x: 4, y: 1 },
    ],
  }

  it('물 높이와 같은 높이로 메운 구덩이에 물이 오른 이동을 센다', () => {
    const result = filledFloods(FILL)

    expect(result.status === 'ok' && result.count).toBeGreaterThan(0)
  })

  it('메운 칸이 없으면 0', () => {
    const heights = FILL.heights.map((row) => row.map((h) => (h < 0 ? 1 : h)))
    expect(filledFloods({ ...FILL, heights })).toEqual({ status: 'ok', count: 0 })
  })

  it('탐색 상태 수 한도를 넘으면 limit', () => {
    expect(filledFloods(FILL, { maxStates: 2 })).toEqual({ status: 'limit' })
  })
})

describe('deadEnds 깊어지는 늪', () => {
  it('이동 제한까지만 펼치고 수에 걸린 막힘과 구조적 막힘을 따로 센다', () => {
    const stage: Stage = { ...DEEP_SWAMP_STAGE, rules: { swampDeepen: true, moveLimit: 20 } }

    const result = deadEnds(stage)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.depth).toBe(20)
    // 되돌릴 수 없는 것이 없는 맵, 구조적 막힘 없이 수에만 걸리는 판
    expect(result.dead).toBe(0)
    expect(result.beyond).toBeGreaterThan(0)
  })

  it('이동 제한이 없으면 ★★ 기준까지 펼쳐 끝낸다', () => {
    const result = deadEnds(DEEP_SWAMP_STAGE)

    expect(result.status).toBe('ok')
    if (result.status !== 'ok') return
    expect(result.depth).toBe(moveLimit(19))
  })
})

describe('tideTraps', () => {
  // 물 높이 1, (1,1) (2,1) (3,1)이 잠기는 줄이고 오를 길이 없는 판
  const TRAP: Stage = {
    version: 1,
    id: 'test-solver-trap',
    heights: [
      [2, 2, 2, 2, 2],
      [2, 1, 1, 1, 2],
      [2, 2, 2, 2, 2],
    ],
    water: 1,
    start: { x: 2, y: 1 },
    goal: { x: 4, y: 0 },
    entities: [],
    rules: { tide: true },
  }

  it('밀물 수에 네 방향이 다 막힌 상태를 센다', () => {
    expect(tideTraps(TRAP)).toEqual({ status: 'ok', count: 2 })
  })

  it('마른 칸으로 나갈 길이 있으면 0', () => {
    const heights = TRAP.heights.map((row, y) => (y === 0 ? [2, 1, 1, 1, 2] : row))
    expect(tideTraps({ ...TRAP, heights, water: 0 })).toEqual({ status: 'ok', count: 0 })
  })

  it('탐색 상태 수 한도를 넘으면 limit', () => {
    expect(tideTraps(TRAP, { maxStates: 2 })).toEqual({ status: 'limit' })
  })
})
