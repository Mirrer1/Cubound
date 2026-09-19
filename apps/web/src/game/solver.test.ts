import { describe, expect, it } from 'vitest'

import { createState, move } from './rules'
import { deadEnds, minPushes, moveLimit, solutionCount, solve, stars, statesWithin } from './solver'
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

// 상자를 (1,2)로 밀면 (2,1)을 메울 수단이 없어져 목표에 갈 수 없다
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
    expect(deadEnds(STAGE)).toEqual({ status: 'ok', states: 8, dead: 0, earliest: null })
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
    expect(deadEnds(stage)).toEqual({ status: 'ok', states: 7, dead: 1, earliest: 4 })
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
