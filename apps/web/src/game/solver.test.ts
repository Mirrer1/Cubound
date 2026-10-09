import { describe, expect, it } from 'vitest'

import { createState, move } from './rules'
import {
  deadEnds,
  eachMove,
  filledFloods,
  floodBlocks,
  minPushes,
  moveLimit,
  solutionCount,
  solve,
  stars,
  statesWithin,
  tideTraps,
} from './solver'
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

describe('solve', () => {
  it('최소 이동 수와 그대로 따라 하면 클리어되는 경로를 돌려준다', () => {
    const result = solve(STAGE)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(4)
    expect(result.path).toHaveLength(4)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(STAGE))
    expect(end.cleared).toBe(true)
  })

  it('목표에 갈 수 없으면 unsolvable을 돌려준다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
      ],
      goal: { x: 2, y: 2 },
    }

    expect(solve(stage).status).toBe('unsolvable')
  })

  it('상자를 밀어야 하는 경로도 찾는다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 1, 1]],
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }
    const result = solve(stage)

    expect(result).toEqual({
      status: 'solved',
      moves: 4,
      path: ['right', 'right', 'right', 'right'],
    })
  })

  it('얼음 미끄러짐을 반영해 최소 이동 수를 찾는다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 0, 0]],
      start: { x: 0, y: 0 },
      goal: { x: 4, y: 0 },
      ice: ['.###.'],
    }

    expect(solve(stage)).toEqual({ status: 'solved', moves: 1, path: ['right'] })
  })

  it('탐색 상태 수 한도를 넘으면 limit을 돌려준다', () => {
    expect(solve(STAGE, { maxStates: 2 }).status).toBe('limit')
  })

  it('보스 이동 제한이 있어도 최소 이동 수는 달라지지 않는다', () => {
    const limited: Stage = { ...STAGE, rules: { moveLimit: 1 } }

    expect(solve(limited)).toEqual(solve(STAGE))
  })

  it('불 상태가 다르면 다른 상태로 보고 숯 벽이 재가 되기를 기다린다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 0]],
      fire: ['.*#.'],
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
    }

    expect(solve(stage)).toEqual({
      status: 'solved',
      moves: 5,
      path: ['right', 'left', 'right', 'right', 'right'],
    })
  })

  it('큐브 불의 남은 수가 다르면 다른 상태로 보고 화로에 다녀온다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 0]],
      fire: ['@.#.'],
      start: { x: 1, y: 0 },
      goal: { x: 3, y: 0 },
    }

    expect(solve(stage)).toEqual({
      status: 'solved',
      moves: 7,
      path: ['left', 'right', 'right', 'left', 'right', 'right', 'right'],
    })
  })
})

describe('moveLimit', () => {
  it('최소 이동 수에 20% 여유를 올림해 더한다', () => {
    expect(moveLimit(20)).toBe(24)
    expect(moveLimit(7)).toBe(9)
  })
})

describe('stars', () => {
  it('최소 이동이면 3개, 여유 안이면 2개, 그 밖은 1개다', () => {
    expect(stars(20, 20)).toBe(3)
    expect(stars(24, 20)).toBe(2)
    expect(stars(25, 20)).toBe(1)
  })

  it('보스 이동 제한을 넘기면 그 제한을 별 기준으로 쓴다', () => {
    expect(stars(20, 20, 22)).toBe(3)
    expect(stars(22, 20, 22)).toBe(2)
    expect(stars(23, 20, 22)).toBe(1)
  })

  it('제한 안에 클리어하면 항상 별이 2개 이상이다', () => {
    const limit = 22
    const inside = Array.from({ length: limit - 20 + 1 }, (_, i) => stars(20 + i, 20, limit))

    expect(inside.every((count) => count >= 2)).toBe(true)
  })
})

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

describe('minPushes', () => {
  it('상자가 없으면 0번이다', () => {
    expect(minPushes(STAGE)).toEqual({ status: 'solved', pushes: 0 })
  })

  it('상자를 꼭 밀어야 하는 맵은 최소로 미는 횟수를 돌려준다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [[0, 0, 0, 0, 1, 1]],
      start: { x: 0, y: 0 },
      goal: { x: 5, y: 0 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }

    expect(minPushes(stage)).toEqual({ status: 'solved', pushes: 2 })
  })

  it('밀지 않고 돌아가는 길이 있으면 최소 이동 풀이가 밀어도 0번이다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [
        [0, 0, 0, 0, 0],
        [0, 0, -1, 0, 0],
        [0, 0, 0, 0, 0],
      ],
      start: { x: 0, y: 1 },
      goal: { x: 4, y: 1 },
      entities: [{ type: 'box', x: 1, y: 1 }],
    }
    const solved = solve(stage)

    expect(solved.status === 'solved' && solved.moves).toBe(4)
    expect(minPushes(stage)).toEqual({ status: 'solved', pushes: 0 })
  })

  it('목표에 갈 수 없으면 unsolvable을 돌려준다', () => {
    const stage: Stage = {
      ...STAGE,
      heights: [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
      ],
    }

    expect(minPushes(stage)).toEqual({ status: 'unsolvable' })
  })

  it('탐색 상태 수 한도를 넘으면 limit을 돌려준다', () => {
    expect(minPushes(STAGE, { maxStates: 2 })).toEqual({ status: 'limit' })
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

describe('eachMove', () => {
  it('시작에서 닿는 모든 이동을 이벤트와 함께 넘긴다', () => {
    const reached = new Set<string>()
    const fills: string[] = []
    const done = eachMove(BOX_TRAP, (moved, events) => {
      reached.add(`${moved.player.x},${moved.player.y}`)
      events.forEach((e) => {
        if (e.type === 'pushed' && e.result === 'filled') fills.push(`${e.to.x},${e.to.y}`)
      })
    })

    expect(done).toBe(true)
    expect(reached.has('3,1')).toBe(true)
    expect(new Set(fills)).toEqual(new Set(['2,1', '1,2']))
  })

  it('막힌 이동도 그 이벤트와 함께 넘긴다', () => {
    const blocked: string[] = []
    eachMove(STAGE, (_, events) => {
      events.forEach((e) => e.type === 'blocked' && blocked.push(e.direction))
    })

    expect(blocked).toContain('up')
  })

  it('탐색 상태 수 한도를 넘으면 false를 돌려준다', () => {
    expect(eachMove(STAGE, () => {}, { maxStates: 2 })).toBe(false)
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

const TRAM_STAGE: Stage = {
  version: 1,
  id: 'test-solver-tram',
  name: '발판 풀이 테스트',
  heights: [
    [0, 0, 0, 0, -1],
    [0, -1, -1, -1, 0],
    [0, 0, 0, 0, -1],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 4, y: 1 },
  entities: [
    {
      type: 'tram',
      x: 1,
      y: 1,
      id: 'tram-a',
      level: 0,
      cells: [
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
      dir: 1,
    },
  ],
}

describe('solve 움직이는 발판', () => {
  it('발판을 타고 건너는 최소 이동 경로를 찾는다', () => {
    const result = solve(TRAM_STAGE)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return

    const end = result.path.reduce((state, d) => move(state, d).state, createState(TRAM_STAGE))
    expect(end.cleared).toBe(true)
    expect(result.moves).toBe(3)
  })
})

const SWAMP_STAGE: Stage = {
  version: 1,
  id: 'test-swamp-solver',
  heights: [[0, 0, 0, 0]],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [],
  swamp: ['.#..'],
}

describe('solve 늪', () => {
  it('늪 한 칸을 지나면 버둥거리는 두 수가 더 든다', () => {
    const plain = solve({ ...SWAMP_STAGE, swamp: undefined })
    const swamp = solve(SWAMP_STAGE)

    expect(plain).toEqual({ status: 'solved', moves: 3, path: ['right', 'right', 'right'] })
    expect(swamp.status === 'solved' && swamp.moves).toBe(5)
  })
})

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

describe('solve 깊어지는 늪', () => {
  it('빠진 횟수가 다르면 다른 상태로 보고 먼 길을 고른다', () => {
    const plain = solve({ ...DEEP_SWAMP_STAGE, rules: undefined })
    const deepen = solve(DEEP_SWAMP_STAGE)

    expect(plain.status === 'solved' && plain.moves).toBe(14)
    expect(deepen.status === 'solved' && deepen.moves).toBe(19)
    expect(deepen.status === 'solved' && deepen.path[0]).toBe('up')
  })

  it('깊어짐은 남기고 이동 제한만 빼고 찾는다', () => {
    const stage: Stage = { ...DEEP_SWAMP_STAGE, rules: { swampDeepen: true, moveLimit: 3 } }

    const result = solve(stage)

    expect(result.status === 'solved' && result.moves).toBe(19)
  })
})

const MUSHROOM_STAGE: Stage = {
  version: 1,
  id: 'test-solver-mushroom',
  heights: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0],
  ],
  start: { x: 0, y: 1 },
  goal: { x: 5, y: 1 },
  entities: [],
  mushroom: ['......', '.#....', '......'],
}

// (2,1) 버섯을 밟아야 끝나 구멍을 지나쳐 다녀오는 판
const WITHER_STAGE: Stage = {
  ...MUSHROOM_STAGE,
  id: 'test-solver-wither',
  goal: { x: 0, y: 0 },
  mushroom: ['......', '..#...', '......'],
  rules: { mushroomWither: true },
}

describe('solve 버섯', () => {
  it('버섯으로 두 칸을 건너뛰는 최소 이동 수를 구한다', () => {
    const result = solve(MUSHROOM_STAGE)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(3)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(MUSHROOM_STAGE))
    expect(end.cleared).toBe(true)
  })

  it('시드는 판은 버섯을 다 밟아야 끝나는 것을 반영한다', () => {
    const plain = solve({ ...WITHER_STAGE, rules: undefined })
    const result = solve(WITHER_STAGE)

    expect(plain.status === 'solved' && plain.moves).toBe(1)
    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(6)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(WITHER_STAGE))
    expect(end.cleared).toBe(true)
    expect(end.mushrooms).toEqual([])
  })
})

// 뿌리에 선 채 시작해 덩굴이 세 칸 다 자라야 건너는 판
const VINE_STAGE: Stage = {
  version: 1,
  id: 'test-solver-vine',
  heights: [[0, 0, -1, -1, -1, 0]],
  start: { x: 1, y: 0 },
  goal: { x: 5, y: 0 },
  entities: [
    {
      type: 'vine',
      id: 'a',
      x: 1,
      y: 0,
      cells: [
        { x: 2, y: 0 },
        { x: 3, y: 0 },
        { x: 4, y: 0 },
      ],
    },
  ],
}

describe('solve 덩굴', () => {
  it('제자리로 돌아와도 덩굴이 더 자랐으면 다른 상태로 보고 기다려서 건넌다', () => {
    const result = solve(VINE_STAGE)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(6)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(VINE_STAGE))
    expect(end.cleared).toBe(true)
  })

  it('굳는 자리는 남기고 찾아 다 자랄 때까지 밟지 않는다', () => {
    const stage: Stage = { ...VINE_STAGE, rules: { vineStop: true } }
    const result = solve(stage)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(8)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(stage))
    expect(end.cleared).toBe(true)
  })
})

// 한 층 내려선 (2, 0)에 심고 올라선 채 솟아야 구멍에 닿는 판, 나갈 길도 탈 발판도 없는 자리
// 발판 길 쪽으로 밀어 제자리에서 기다리는 네 수
const SEED_STAGE: Stage = {
  version: 1,
  id: 'test-solver-seed',
  heights: [
    [1, 1, 0, 1],
    [-1, -1, -1, -1],
  ],
  start: { x: 0, y: 0 },
  goal: { x: 3, y: 0 },
  entities: [
    { type: 'seed', x: 1, y: 0 },
    {
      type: 'tram',
      id: 't',
      level: 1,
      dir: 1,
      x: 3,
      y: 1,
      cells: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
      ],
    },
  ],
}

describe('solve 씨앗', () => {
  it('평지에서 옆 칸을 오가며 기다려 올라탄 채 솟아야만 한 층 위 구멍에 닿는다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-solver-seed-flat',
      heights: [[0, 0, 0, 1]],
      start: { x: 0, y: 0 },
      goal: { x: 3, y: 0 },
      entities: [{ type: 'seed', x: 1, y: 0 }],
    }
    const result = solve(stage)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(8)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(stage))
    expect(end.cleared).toBe(true)
  })

  it('심은 칸 위에서 기다린 수를 다른 상태로 보고 같이 솟아 건넌다', () => {
    const result = solve(SEED_STAGE)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(8)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(SEED_STAGE))
    expect(end.cleared).toBe(true)
  })

  it('콩나무는 남기고 찾아 두 번 솟은 칸에서 두 층 높은 구멍으로 간다', () => {
    // (2, 1)에 위쪽을 보고 심는 판, 세 칸 발판 길로 솟은 칸 위에서도 기다리는 자리
    const stage: Stage = {
      ...SEED_STAGE,
      heights: [
        [0, 0, 1, 0],
        [0, 0, 0, 2],
        [0, 0, -1, -1],
        [0, 0, -1, -1],
      ],
      start: { x: 0, y: 1 },
      goal: { x: 3, y: 1 },
      entities: [
        { type: 'seed', x: 1, y: 1 },
        {
          type: 'tram',
          id: 't',
          level: 0,
          dir: 1,
          x: 2,
          y: 3,
          cells: [
            { x: 2, y: 2 },
            { x: 2, y: 3 },
            { x: 3, y: 3 },
          ],
        },
      ],
      rules: { seedGrow: true },
    }
    const result = solve(stage)

    expect(solve({ ...stage, rules: undefined }).status).toBe('unsolvable')
    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(12)

    const end = result.path.reduce((state, d) => move(state, d).state, createState(stage))
    expect(end.cleared).toBe(true)
  })
})

describe('solve 바람', () => {
  it('바람에 밀려 같은 칸을 다시 지나도 남은 수가 다르면 다른 상태로 본다', () => {
    // 네 수째에 왼쪽으로 한 칸 밀려 두 수를 더 걷는 판
    const stage: Stage = {
      version: 1,
      id: 'test-wind',
      heights: [[0, 0, 0, 0, 0, 0]],
      start: { x: 0, y: 0 },
      goal: { x: 5, y: 0 },
      entities: [],
      rules: { wind: 'left' },
    }
    const result = solve(stage)

    expect(result.status).toBe('solved')
    if (result.status !== 'solved') return
    expect(result.moves).toBe(6)
    expect(solve({ ...stage, rules: undefined })).toMatchObject({ status: 'solved', moves: 5 })
  })
})

describe('solve 물', () => {
  it('상자를 띄워 타고 물길을 건너는 최소 풀이를 찾는다', () => {
    const stage: Stage = {
      version: 1,
      id: 'test-water',
      heights: [
        [1, 1, 0, 1, 1],
        [1, 1, 0, 1, 1],
        [1, 1, 0, 1, 1],
      ],
      water: 1,
      start: { x: 0, y: 1 },
      goal: { x: 4, y: 1 },
      entities: [{ type: 'box', x: 1, y: 0 }],
    }

    expect(solve(stage)).toEqual({
      status: 'solved',
      moves: 6,
      path: ['up', 'right', 'right', 'right', 'right', 'down'],
    })
  })
})

describe('solve 묶인 배', () => {
  // 물 높이 1, y 1~3이 물 칸, (2,0) 말뚝에 줄 길이 2로 묶인 배가 (1,1), 자유 배가 (2,3)
  const TETHER_STAGE: Stage = {
    version: 1,
    id: 'test-solver-tether',
    heights: [
      [1, 1, 1, 1, 1],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [1, 1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 1, y: 0 },
    goal: { x: 0, y: 4 },
    entities: [
      { type: 'box', x: 1, y: 1 },
      { type: 'box', x: 2, y: 3 },
      { type: 'post', x: 2, y: 0, length: 2, boat: { x: 1, y: 1 } },
    ],
  }

  it('묶인 배가 못 가는 곳은 자유 배로 갈아타 건너는 길을 찾는다', () => {
    expect(solve(TETHER_STAGE)).toEqual({
      status: 'solved',
      moves: 7,
      path: ['down', 'right', 'down', 'down', 'down', 'left', 'left'],
    })
  })

  it('묶인 배와 자유 배가 자리를 맞바꾸면 다른 상태로 센다', () => {
    const pond: Stage = {
      ...TETHER_STAGE,
      heights: [
        [1, 1, 1, 1],
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [1, 1, 1, 1],
      ],
      goal: { x: 3, y: 3 },
      entities: [
        { type: 'box', x: 1, y: 1 },
        { type: 'box', x: 2, y: 2 },
        { type: 'post', x: 0, y: 1, length: 3, boat: { x: 1, y: 1 } },
      ],
    }
    const found = deadEnds(pond)

    expect(found.status === 'ok' && found.states).toBe(148)
  })
})

describe('solve 마개', () => {
  // 물 높이 1, (1,1) 땅 상자 아래 (1,2)와 오른쪽 (2,1)에 소용돌이, 어느 쪽을 막아도 큐브는 (1,1)
  const PLUG_STAGE: Stage = {
    version: 1,
    id: 'test-solver-plug',
    heights: [
      [1, 1, 1, 1],
      [1, 1, 0, 1],
      [1, 0, 1, 1],
      [1, 1, 1, 1],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 3, y: 3 },
    entities: [
      { type: 'whirlpool', x: 1, y: 2 },
      { type: 'whirlpool', x: 2, y: 1 },
      { type: 'box', x: 1, y: 1 },
    ],
    rules: { plug: true },
  }

  it('어느 소용돌이를 막았는지가 다르면 다른 상태로 센다', () => {
    const found = deadEnds(PLUG_STAGE)

    expect(found.status === 'ok' && found.states).toBe(41)
  })

  it('막은 소용돌이 칸을 배로 지나는 길을 찾는다', () => {
    // (2,2) 소용돌이를 (2,1) 상자로 막아야 (1,2) 배로 건너는 판, x 3의 높이 3 벽
    const channel: Stage = {
      ...PLUG_STAGE,
      heights: [
        [1, 1, 1, 3, 1],
        [1, 1, 1, 3, 1],
        [1, 0, 0, 0, 1],
      ],
      goal: { x: 4, y: 0 },
      entities: [
        { type: 'whirlpool', x: 2, y: 2 },
        { type: 'box', x: 2, y: 1 },
        { type: 'box', x: 1, y: 2 },
      ],
    }
    const result = solve(channel)

    expect(result.status === 'solved' && result.moves).toBe(10)
  })
})

describe('solve 얼음 돌', () => {
  // 물 높이 1, y 2 줄이 물 칸, x 2의 높이 3 벽, (1,1) 돌을 아래로 띄워 언 칸 (0,2)로 건너는 판
  const STONE_STAGE: Stage = {
    version: 1,
    id: 'test-solver-ice-stone',
    heights: [
      [1, 1, 3],
      [1, 1, 3],
      [0, 0, 0],
      [1, 1, 1],
    ],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 1, y: 3 },
    entities: [{ type: 'iceStone', x: 1, y: 1 }],
  }

  it('돌 자리가 다른 상태를 합치지 않아 같은 칸으로 돌아오는 풀이를 찾는다', () => {
    const result = solve(STONE_STAGE)

    expect(result.status === 'solved' && result.path).toEqual([
      'right',
      'down',
      'left',
      'down',
      'right',
    ])
  })

  it('녹는 판은 숫자를 지킨 채 푼다', () => {
    expect(solve({ ...STONE_STAGE, rules: { melt: 2 } }).status).toBe('solved')
    expect(solve({ ...STONE_STAGE, rules: { melt: 1 } }).status).toBe('unsolvable')
  })
})

describe('solve 갑문', () => {
  // 물 높이 1, 가 웅덩이 (1,0)의 배가 장치가 빈 동안 높은 물에 떠 집 (2,0)과 같은 높이
  const LOCK: Stage = {
    version: 1,
    id: 'test-solver-lock',
    heights: [[2, 0, 2, 2, 0]],
    water: 1,
    start: { x: 0, y: 0 },
    goal: { x: 2, y: 0 },
    entities: [
      { type: 'box', x: 1, y: 0 },
      { type: 'sluice', x: 3, y: 0 },
    ],
    rules: { lock: { x: 1, y: 0 } },
  }

  it('갑문 규칙을 지킨 채 푼다', () => {
    expect(solve(LOCK)).toEqual({ status: 'solved', moves: 2, path: ['right', 'right'] })
    expect(solve({ ...LOCK, rules: undefined }).status).toBe('unsolvable')
  })
})

describe('solve 밀물', () => {
  // 물 높이 2, (1,1) 물에 배, (2,1)과 골 (3,1)이 높이 3, 밀물 때 배로 오르는 판
  const TIDE: Stage = {
    version: 1,
    id: 'test-solver-tide',
    heights: [
      [3, 3, 5, 5],
      [3, 0, 3, 3],
    ],
    water: 2,
    start: { x: 1, y: 0 },
    goal: { x: 3, y: 1 },
    entities: [{ type: 'box', x: 1, y: 1 }],
    rules: { tide: true },
  }

  it('같은 자리라도 물때가 다르면 다른 상태로 보고 밀물을 기다려 푼다', () => {
    const solved = solve(TIDE)

    expect(solved.status).toBe('solved')
    expect(solved.status === 'solved' && solved.moves).toBe(7)
    expect(solve({ ...TIDE, rules: undefined }).status).toBe('unsolvable')
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
